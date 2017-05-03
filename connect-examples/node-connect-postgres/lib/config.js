module.exports = {
  server: {
    port: process.env.HTTP_SERVER_PORT || 8998,
    path: process.env.HTTP_SERVER_PATH || '/'
  },
  connect: {
    app: process.env.UA_APP_KEY,
    token:  process.env.UA_CONNECT_TOKEN
  },
  postgres: {
    user: 'urban_airship_connect',
    password: process.env.CONNECT_PW,
    database: 'urban_airship_connect',
    host: process.env.PGHOST,
    port: process.env.PGPORT,
      // these last tow are connect configs, but we care about them in the
      // postgres module.
    query: process.env.UA_CONNECT_QUERY || {start: "EARLIEST"}, 
    offsetCommitInterval: 1000 * 1
  }
}

