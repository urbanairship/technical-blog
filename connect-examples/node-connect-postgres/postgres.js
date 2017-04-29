var pg = require('pg')
var through = require('through2').obj
var xtend = require('xtend')
var pino = require('pino')({
  slowtime: true,
  level: 'info'
})

module.exports = pgStream


function pgStream (app, config, ready) {
  var pool = new pg.Pool(config)

  var FIRST_TIME =  {
    // total hack-- set the pk of the row to the pk we used to look it up, just
    // so we get data for the row back. The resume offset will be zero if there
    // was nothing there.
    text: 'INSERT INTO apps(app, stream_offset) VALUES ($1, $2) ON CONFLICT (app) DO UPDATE SET app=$1 RETURNING stream_offset',
    values: [app, 0],
    name: 'seed-app-and-get-offsets'
  }


  var UPDATE =  {
    text: 'INSERT INTO apps(app, stream_offset) VALUES ($1, $2) ON CONFLICT (app) DO UPDATE SET stream_offset=$2 RETURNING (stream_offset)',
    name: 'update-and-get-offsets'
  }


  pool.query(FIRST_TIME)
    .then(function (res) {
      pino.debug({'message': 'starting query', 'pg response': res})

      var query = config.query

      var resume = res.rows[0].stream_offset
      if (resume) {
        query.resume_offset = resume
        delete query.start
      } 

      ready(null, {
        offset: offsetStream,
        connectData: connectData,
        query: query
      })
    })
    .catch(ready)

  function connectData() {
    var now = new Date();

    var stream = through(transform)

    return stream

    function transform (event, encoding, cb) {
      pool.query('INSERT INTO events (app, event, id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING RETURNING (id);', [app, JSON.stringify(event), event.id])
        .then(function (res) {
          pino.debug({'message': 'insert data query', 'pg response': res})
          if (!res.rows.length) {
            pino.debug({message: 'attempted to insert already existing data did nothing', id: event.id, app: app})
            cb()
            return;
          }

          pino.debug({message: 'inserted', event: event, id: event.id, app: app})
          if (new Date() - now > config.offsetCommitInterval) {
            stream.push(event.offset)
            now = new Date();
          }
          cb()
        })
        .catch(ready)
    }
  }

  function offsetStream() {
    return through(transform) 

    function transform(offset, encoding, cb) {
      var update = xtend(UPDATE, {values: [app, offset]})
      pool.query(update)
        .then(function (res) {
          pino.info({message: 'saved offset', offset: offset, app: app})
          cb()
        }).catch(cb)
    }
  }
}

