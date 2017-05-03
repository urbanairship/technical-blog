-- populate the main events table
-- $1 app
-- $2 event json
-- $3 event uuid

INSERT INTO events (app, event, id, occurred) VALUES 
($1, $2, $3, $4)  ON CONFLICT DO NOTHING 
RETURNING (id, app, event, occurred);
