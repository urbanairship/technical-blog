var pg = require('pg')
var through = require('through2').obj
var xtend = require('xtend')
var pinoLib = require('pino')
var pino = pinoLib({
  level: 'info'
})
var fs = require('fs')

var insertSql = fs.readFileSync('./lib/insert.sql').toString()
var getIdsSql = fs.readFileSync('./lib/getChannels.sql').toString()
var getEventsForChannelSql = fs.readFileSync('./lib/getEventsForChannel.sql').toString()

module.exports = pgStream

module.exports.reading = function (app, config, ready) {
  var pool = new pg.Pool(config)
  setImmediate(function() {
    ready(null, {users: getIds, events: getEvents})
  })

  function getIds() {
    var stream = through(query)

    return stream
    /**
     * Stream from {limit: number, offset: number, key: {<some key on the device
     * object>}} to identifiers for the given query. Each identifier list
     * returned also has the query information on it.
     */
    function query(chunk, enc, cb) {
      pool.query(getIdsSql, ['{device, ' + chunk.key + '}', app, chunk.limit || 100, chunk.offset || 0])
        .then(function (res) {
          stream.push(res.rows || [])
          cb()
        }).catch(function(e) {
          stream.emit('error', {message: e.message, stack: e.stack, e})
        })
    }
  }

  function getEvents() {
    var stream = through(query)

    return stream

    function query(chunk, enc, cb) {
      pino.info("got query", chunk)
      var insert = {}
      insert[chunk.key] = chunk.value
      pool.query(getEventsForChannelSql, 
          [
            JSON.stringify({device: insert}),
            app,
            chunk.limit,
            chunk.offset
          ])
        .then(function (res) {
          stream.push(res.rows || [])
          cb()
        })
      .catch(function(e) {
          stream.emit('error', {message: e.message, stack: e.stack, e})
        })
    }
  }
}

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
      pool.query(insertSql, [app, JSON.stringify(event), event.id, +(new Date(event.occurred))])
        .then(function (res) {
          pino.debug({'message': 'insert data', 'pg response': res, event: event})
          if (!res.rows.length) {
            pino.debug({message: 'attempted to insert already existing data did nothing', id: event.id, app: app})
            cb()
            return false;
          }

          if (new Date() - now > config.offsetCommitInterval) {
            stream.push(event.offset)
            now = new Date();
          }
          cb()
          return true;
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



