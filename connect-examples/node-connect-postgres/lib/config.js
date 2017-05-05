module.exports = {
  server: {
    // An HTTP server which provides get RESOURCES for the user timeline.
    // It needs a port and path at which to listen for requests.
    port: process.env.HTTP_SERVER_PORT || 8998,
    path: process.env.HTTP_SERVER_PATH || '/'
  },
  connect: {
    // Urban Airship Connect credentials. See https://docs.urbanairship.com/connect/getting-started/#con-getting-started-generate-token
    // if you don't know how to get connect credentials.
    app: process.env.UA_APP_KEY,
    token: process.env.UA_CONNECT_TOKEN
  },
  postgres: {
    // postgres stuff
    database: 'urban_airship_connect',
    user: 'urban_airship_connect',
    password: process.env.CONNECT_PW,
    host: process.env.PGHOST,
    port: process.env.PGPORT,

    // query is the body of the connect request which we'll use to get data
    // to put into postgres.
    //
    // See https://docs.urbanairship.com/api/connect/#connect-request-body
    // for documentation on valid values.
    //
    // If you have a fast app, but would like to run this example, I recommend
    // filtering for the users you care about, e.g.
    // UA_CONNECT_QUERY = '{"start": "EARLIEST", "filters": {"devices": "named_user_id": "AWinterman"}}'
    query: JSON.parse(process.env.UA_CONNECT_QUERY) || {start: 'EARLIEST'},

    // how frequently to commit our offset. You might consume events that
    // happened since the last offset more than once, but the our INSERT
    // statement no-ops on event id collisions, so no harm done.
    offsetCommitInterval: 1000 * 60
  }
}
