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
        occurred bigint            NOT NULL,
        PRIMARY KEY (app, id)
);

CREATE TABLE pushes(
        app             varchar(22)       NOT NULL REFERENCES apps ON DELETE CASCADE,
        event           uuid              NOT NULL REFERENCES events.id ON DELETE CASCADE,,
        notification    uuid              UNIQUE NOT NULL,
);

CREATE OR REPLACE FUNCTION storeInPushTable() RETURNS NULL AS 
$$ INSERT INTO pushes(app, event, notification) VALUES
        (NEW.app, NEW.id, COALESCE(NEW.event->'{group_id}', NEW.event->'{push_id}')
                ON CONFLICT DO NOTHING 
                $$ LANGUAGE SQL VOLATILE;

CREATE TRIGGER pushTrigger AFTER INSERT ON events 
        WHEN NEW.event@>'{"type": "PUSH_BODY"}' 
                EXECUTE PROCEDURE storeInPushTable();

GRANT ALL ON apps TO urban_airship_connect;
GRANT ALL ON events TO urban_airship_connect;
