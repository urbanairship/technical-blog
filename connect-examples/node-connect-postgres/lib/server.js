var postgres = require('./postgres').reading
var http = require('http')
var url = require('url')
var config = require('./config')
var xtend = require('xtend')
var through = require('through2').obj
var os = require('os')

var CONTENT_TYPE = {'Content-Type': 'application/json'}

var pino = require('pino')({level: 'info'})

/**
 * Exports function which creates an http server which exposes HTTP endpoints
 * for a user timeline. Uses ./postgres to fulfill requests.
 */
var lastEvent = {}
module.exports = function (config, connectStream, ready) {
  connectStream.on('data', function (data) {
    lastEvent = data
  })

  postgres(config.connect.app, config.postgres, onPostgresConnection, ready)
}

function getUrl (server, path, opts) {
  return url.format(xtend({
    protocol: 'http',
    hostname: os.hostname(),
    pathname: path,
    port: server.address().port
  }, opts))
}

function onPostgresConnection (err, pg, connectStream, ready) {
  if (err) {
    ready(err)
  }

  var server = http.createServer(gotRequest)

  var usersPath = config.server.path + 'users'
  var eventsPath = config.server.path + 'events'
  var infoPath = config.server.path

  server.listen(config.server.port, function () {
    pino.info('listening at', getUrl(server, infoPath))
  })

  function gotRequest (req, res) {
    try {
      var u = url.parse(req.url, true, true)
      var stream
      var display

      if (u.pathname === infoPath) {
        stream = through()
        display = through(function (data, enc, cb) {
          this.push({
            channels: {url: getUrl(server, usersPath),
              params: {
                key: 'the kind of user identifier to provide a histogram',
                limit: 'how many records to return',
                offset: 'which element to start at'
              }},
            events: {url: getUrl(server, eventsPath),
              params: {
                key: 'the kind of user identifier we want to show a user timeline for',
                value: 'the identifier value',
                limit: 'how many records to return',
                offset: 'which element to start at'
              }},
            lastEvent: lastEvent
          })
          cb()
        })
      } else if (u.pathname === usersPath) {
        pino.debug('found users', req.url, usersPath)

        u.query.key = (u.query.key || 'named_user_id')
        stream = pg.users()
        display = formatUsers(u.query, server, eventsPath)
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
    } catch (e) {
      pino.error('server error', e, e && e.message, e && e.strack)
      res.writeHead(500, CONTENT_TYPE)
      res.end('server error')
    }

    function failure (err) {
      res.writeHead(400, CONTENT_TYPE)
      res.end(JSON.stringify(err))
    }
  }
}

function e404 (req, response) {
  response.writeHead(404, CONTENT_TYPE)
  response.end(JSON.stringify({'message': 'not found'}))
}

function formatEvents (query) {
  var stream = through(transform)
  return stream
  function transform (chunk, enc, cb) {
    this.push(xtend(query, {events: chunk.map(row => {
      var message = row.message
      if (message.body && message.body.payload) {
        message.body.payload = JSON.parse(Buffer.from(message.body.payload, 'base64').toString())
      }
      return message
    })}))
    cb()
  }
}

function formatUsers (query, server, path) {
  var stream = through(transform)
  return stream
  function transform (chunk, enc, cb) {
    this.push(xtend(query, {ids: chunk.filter(Boolean).map(function (device) {
      device.url = getUrl(server, path, {query: {value: device.device[query.key], key: query.key}})
      return device
    })}))
    cb()
  }
}

function stringify () {
  var stream = through(transform)
  return stream
  function transform (chunk, enc, cb) {
    this.push(JSON.stringify(chunk))
    cb()
  }
}
