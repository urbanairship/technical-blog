var postgres = require('./postgres').reading
var concat = require('concat-stream')
var http = require('http')
var url = require('url')
var config = require('./config')
var xtend = require('xtend')
var through = require('through2').obj

var CONTENT_TYPE = {'Content-Type': 'application/json'}

var pino = require('pino')({level: 'info'})

module.exports = function(config, ready) {
  postgres(config.connect.app, config.postgres, onPostgresConnection, ready)
}
  
function onPostgresConnection(err, pg, ready) {
    if (err) {
      ready(err); 
    }

    var server = http.createServer(gotRequest)

    var usersPath = config.server.path + 'users'
    var eventsPath = config.server.path + 'events'

    server.listen(config.server.port, function() {
      pino.info('listening at', config.server)
    })

    function gotRequest(req, res) {

      try {
        var u = url.parse(req.url, true, true)
        var stream;
        var display;

        if (u.pathname === usersPath) {
          pino.debug('found users', req.url, usersPath)

          u.query.key = (u.query.key || 'named_user_id')
          stream = pg.users()
          display = formatUsers(u.query)
        } else if (u.pathname === eventsPath) {
          pino.debug(req.url.query)
          if (!u.query || !u.query.key || !u.query.value) {
            return failure({'message': 'need to specify key and value in query strings', query: req.url.query})
          }
          pino.debug('found events', req.url, usersPath)
          stream = pg.events()
          display = formatEvents(u.query)
        } else {
          pino.debug('404', 
              req.url
              )
          return e404(req, res)
        }

        stream 
          .on('error', failure)

        stream.pipe(display).pipe(stringify()).pipe(res)

        stream.end(u.query)

        function success(data) {
            res.writeHead(200, CONTENT_TYPE)
            res.end(JSON.stringify(data))
        }

        function failure(err) {
            res.writeHead(400, CONTENT_TYPE)
            res.end(JSON.stringify(err))
        }

      } catch (e) {
        pino.error('server error', e, e && e.message, e && e.strack)
        res.writeHead(500, CONTENT_TYPE) 
        res.end('server error')
      }
    }
}


function e404(req, response) {
  response.writeHead(404, CONTENT_TYPE)
  response.end(JSON.stringify({'message': 'not found'}))
}

function formatEvents(query) {
  var stream = through(transform)
  return stream
  function transform(chunk, enc, cb) {
    this.push(xtend(query, {events: chunk.map(function(d) { return d.event})}))
      cb()

  }
}

function formatUsers(query) {
  var stream = through(transform)
  return stream
  function transform(chunk, enc, cb) {
    this.push(xtend(query, {ids: chunk.filter(Boolean)}))
    cb()
  }
}


function stringify() {
  var stream = through(transform)
  return stream
  function transform(chunk, enc, cb) {
    this.push(JSON.stringify(chunk))
      cb()
      
  }
}
