var config = require('./lib/config')
var pino = require('pino')({level: 'info'})
var consumer = require('./lib/consumer')
var server = require('./lib/server')

process.on('unhandledRejection', function(e) {
    pino.error('unhandled rejection', e.message, e.stack)
    process.exit(1)
})

consumer(config, ready)
server(config, ready)

function ready(err) {
  if (err) {
    pino.error("caught error; exiting", err.message, err.stack)
    process.exit(1)
  }
}

