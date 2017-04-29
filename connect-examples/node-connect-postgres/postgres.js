var pg = require('pg')
var through = require('through2').obj
var xtend = require('xtend')

module.exports = pgStream

function pgStream (app, config, ready) {
  var pool = new pg.Pool(config)

  var UPDATE =  {
    text: 'INSERT INTO apps(app, stream_offset) VALUES ($1, $2) ON CONFLICT (app) DO UPDATE SET stream_offset=$2 RETURNING (stream_offset)',
    values: [app, 0],
    name: 'update-and-get-offsets'
  }

  pool.query(UPDATE)
    .then(function (res) {
      console.log("res", res)

      var query = config.query
      var resume = res.rows[0].stream_offset

      if (resume) {
        query.resume_offset = resume
        delete query.start
      } 

      ready(null, {
        offset: offset,
        connectData: connectData,
        start: start(query)
      })
    })
    .catch(ready)

  function start (query) {
    console.log('providing stream provider')
    return function asStream() {
      console.log('providing stream')
      var stream = through(function (chunk, encoding, cb) {
        console.log('emitting ' + query)
        this.push(query)
        cb() 
      })
      setImmediate(function() { stream.write({}) })
      return stream
    }
  }

  function connectData() {
    return through(transform)

    function transform (data, encoding, cb) {
      console.log("inserting " + data)
      pool.query('INSERT INTO events (app, event) VALUES ($1, $2);', [app, JSON.stringify(data)])
        .then(function (res) {
          cb()
        })
        .catch(ready)
    }
  }

  function offset(intervalMillis) {
    return through(transform) 

    function transform(chunk, encoding, cb) {
      var update = xtend(UPDATE, {values: [app, chunk.offset]})
      pool.query(update)
        .then(function (res) {
          cb()
        }).catch(cb)
    }
  }
}

