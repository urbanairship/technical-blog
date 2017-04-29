DROP TABLE IF EXISTS apps;
DROP TABLE IF EXISTS events;

CREATE TABLE events(
        app   varchar(22)       NOT NULL,
        event jsonb             NOT NULL
);

CREATE TABLE apps(
        stream_offset   bigint,
        app             varchar(22)     NOT NULL,
        PRIMARY KEY (app)
);

GRANT ALL ON apps TO urban_airship_connect;
GRANT ALL ON events TO urban_airship_connect;

-- things you might want to index on:
--
-- device identifiers and platforms: 
--      ios_channel
--      android_channel
--      amazon_channel
--      channel

-- any custom device identifiers your sdk might set.

-- notification identifiers
--      push_id
--      group_id
--      triggering_push,push_id,
--      triggering_push,group_id
--      last_delivered,push_id,
--      last_delivered,group_id
--      replacing_push,push_id,
--      replacing_push,group_id
