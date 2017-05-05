var connect = require('urban-airship-connect')
var xtend = require('xtend')
var postgres = require('./postgres')

var pino = require('pino')({level: 'info'})

module.exports = consumer

/**
 * Defines a consumer from the connect api. Uses ./postgres to record its
 * offsets, and write data to an underlying postgres instance.
 */
function consumer (config, ready) {
  var connectStream = connect(config.connect.app, config.connect.token)
  var postgresStreamConfig = config.postgres

  pino.info({'config': xtend(postgresStreamConfig, {password: 'redacted'})})

  postgres(config.connect.app, postgresStreamConfig, function (err, pg) {
    if (err) {
      throw ready(err)
    }

    connectStream
      .pipe(pg.connectData())
      .pipe(pg.offset())

    pino.info({message: 'starting query', query: pg.query, app: config.connect.app})
    connectStream.write(pg.query)
  })

  ready(null, connectStream)
}
