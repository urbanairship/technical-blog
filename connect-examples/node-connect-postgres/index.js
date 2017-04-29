var connect = require('urban-airship-connect')
var postgres = require('./postgres')
var xtend = require('xtend')
var pino = require('pino')({level: 'debug'})

process.on('unhandledRejection', function(e) {
    pino.error('unhandled rejection', e.message, e.stack)
    process.exit(1)
})

var app = process.env.UA_APP_KEY
var token = process.env.UA_CONNECT_TOKEN

if (!app || !token) {
  pino.error({message: "requier app and token got", app: app, token: token})
  process.exit(1)
}

var connectStream = connect(app, token)


var config = {
  user: 'urban_airship_connect',
  password: process.env.CONNECT_PW,
  database: 'urban_airship_connect',
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  query: process.env.UA_CONNECT_QUERY || {start: "EARLIEST"}, 
  offsetCommitInterval: 1000 * 1
}

pino.info({'config': xtend(config, {password: 'redacted'})})

var postgresStream = postgres(app, config, function (err, pg) { 
  if (err) {
    throw err
  }

  connectStream
    .pipe(pg.connectData())
    .pipe(pg.offset())

  pino.info({message: "starting query", query: pg.query, app: app})
  connectStream.write(pg.query)
})



