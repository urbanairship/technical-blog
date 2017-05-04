-- This schema uses postgres jsonb schema to simplify dramatically the
-- write-side code of this tiny little web app. 

DROP TABLE IF EXISTS apps CASCADE;
DROP TABLE IF EXISTS events CASCADE;

CREATE TABLE apps(
        stream_offset   bigint,
        app             varchar(22)     NOT NULL PRIMARY KEY
);

CREATE TABLE events(
        app      varchar(22)       NOT NULL REFERENCES apps ON DELETE CASCADE,
        event    jsonb             NOT NULL,
        id       uuid              UNIQUE NOT NULL,
        PRIMARY KEY (app, id)
);

-- The query side is dramatically sped up by the presence of these indices:
CREATE INDEX deviceidx on events USING GIN ((event->'device'));
CREATE INDEX pushidx on events USING GIN ((event->'push_id'));
CREATE INDEX groupidx on events USING GIN ((event->'group_id'));
CREATE INDEX lastdeliveredidx on events USING GIN ((event->'last_delivered'));
CREATE INDEX triggeringidx on events USING GIN ((event->'triggering_push'));
CREATE INDEX replacingidx on events USING GIN ((event->'replacing_push'));

GRANT ALL ON apps TO urban_airship_connect;
GRANT ALL ON events TO urban_airship_connect;
