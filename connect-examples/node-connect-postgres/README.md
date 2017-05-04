# node connect postgres

An example of getting connect data into postgres, and of one possible analytics
application built on top of the tables that result. It's probably not suitable
for a big production app because it inserts individual events into postgres as
it receives them.

I tested it with an AWS RDS PostgreSQL instance of the `db.t2.micro` class. 

## Configuration, installation and running

It's a node project, so install node either via whatever package manager you like, 
or by choosing the appropriate installer from the 
[node organization web site](https://nodejs.org/en/download/)

Once you have node installed, run `npm i` in this directory to install its
dependencies. Once these are installed, and assuming you have the PostgreSQL
client installed, you can create the schema and required users with:

```bash
PGHOST=<postgres host> PGPORT=<a port> npm run user 
PGHOST=<postgres host> PGPORT=<a port> PGUSER=<admin user> npm run schema
```

Then you can start the postgres populator with 

```bash
UA_APP_KEY="the app key for your urban airship app"
UA_CONNECT_TOKEN="your authentication token"
UA_CONNECT_QUERY="" # The JSON query we should use to retrieve data from connect.
                    #  Defaults to `{start: "EARLIEST"}`
CONNECT_PW="the password for the postgres user our app will authenticate as in order to store data in postgres."
PGHOST="the host where postgres is running."
PGPORT="The port where postgres is running."
npm start
```

I've included a convenience npm script for connecting to the postgres instance
configured with your environment variables; namely `npm run connect`

## HTTP Service

Running `npm start` also starts an HTTP service which provides a JSON REST API
for a pair of particular queries against this postgres database. 

> NB: It's clearly sub-optimal to have the read and write services both running
> in the same thread, but since this is intended for demo/hey-that's-kinda-neat
> purposes, I chose the simpler path of just running them both in the same
> process. 

### `GET /users`

A Histogram of the count of events of the users we've ever seen.

#### Parameters

- `key`: One of the top level keys that on the device event, e.g.
         `named_user_id` or `ios_channel`.
- `offset`: Index of the device info where we should start reading.
- `limit`: The number of records to read

An http get against this resource returns device data for each device identifier
specified by `key`. It is sorted by the number of events for which the user is
responsible over their recorded lifetime. 

```
{
  "key": "named_user_id",
  "ids": [
    {
      "device": {
        "attributes": {
        "carrier": "AT&T",
        "device_os": "10.2.1",
        "app_version": "460",
        "push_opt_in": "true",
        "device_model": "iPhone7,2",
        "iana_timezone": "America/Los_Angeles",
        "locale_variant": "",
        "ua_sdk_version": "8.0.4",
        "connection_type": "WIFI",
        "locale_timezone": "-25200",
        "app_package_name": "com.urbanairship.goat",
        "location_enabled": "true",
        "locale_country_code": "US",
        "location_permission": "ALWAYS_ALLOWED",
        "locale_language_code": "en",
        "background_push_enabled": "true"
      },
      "identifiers": {
        "ADID": "specialspecial",
        "aaid": "special",
        "session_id": "F3555B4F-5259-41AD-99A5-7F27E2C874E6",
        "com.urbanairship.idfa": "262EC068-D7EB-4445-B7AB-2DDD75485111",
        "com.urbanairship.vendor": "0E15C8B9-65B7-4739-9E92-290FD53EA3F5",
        "com.urbanairship.limited_ad_tracking_enabled": "true"
      },
        "ios_channel": "62ccb785-adf7-4cdc-872a-4226a22be31a",
        "named_user_id": "cool-user-1999"
      },
      "count": "165"
    },
  ...
  ]
}
```

### `GET /events`

- `key`: A top level key identifying devices, e.g. `named_user_id` or
  `ios_channel`
- `value`: The value of the key that you'd like to match. The pair together
  says: "Show me all the events originating from a device which has `{"<key>",
  "<value>"}` in its device object.
- `offset`: Index of the event where we should start reading.
- `limit`: The number of records to read

The response is a time-ordered list of all the events which refer to the user,
including the any push bodies (that occurred since we started consuming) that
define notifications the user received.


