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



