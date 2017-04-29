var connect = require('urban-airship-connect')
var postgres = require('./postgres')
var xtend = require('xtend')

process.on('unhandledRejection', function(e) {
    console.error(e.message, e.stack)
    process.exit(1)
})

var app = process.env.UA_APP_KEY
var token = process.env.UA_CONNECT_TOKEN

if (!app || !token) {
  console.error("requier app and token got", app, token)
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
  offsetCommitInterval: 1000 * 60 // every minute
}

console.log(xtend(config, {password: 'redacted'}))


var postgresStream = postgres(app, config, function (err, streams) { 
  if (err) {
    throw err
  }

  streams.start()
    .pipe(connectStream)
    .pipe(streams.connectData())


  connectStream.pipe(streams.offset())
})



