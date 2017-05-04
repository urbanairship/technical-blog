-- An over complicated theory to do the following:

-- get all the events that occurred to a particular user
-- for each such event, find any push notifications that may have
        -- influenced the user's behavior.
-- sort the resulting events in time, with most recent events first.

-- NOTE: this is a prety slow query. I think we could speed this up by defining
-- more structure upfront when we write, which would mean updating our schmea.
-- In particular, we could add columns for each of the fields we query on, and a
-- table with a "references" relationship between the device specific event and 
-- the push body event to which it was related. 

-- PARAMETERS:
-- 1 device object match
-- 2 app 
-- 3 limit
-- 4 offset

WITH RECURSIVE E AS (
        -- essentially makes a temporary table with each event, and each of the possible
        -- identifiers on it. We don't care about push vs group for these
        -- purposes
        SELECT
                A.event as message,
                A.event->'occurred' as occurred,
                COALESCE(A.event->'body'->>'group_id', A.event->'body'->>'push_id') AS fulfills,
                COALESCE(A.event->'body'->'last_delivered'->>'push_id', A.event->'body'->'last_delivered'->>'group_id') as precedes,
                COALESCE(A.event->'body'->'triggering_push'->>'push_id', A.event->'body'->'triggering_push'->>'group_id') as triggers,
                COALESCE(A.event->'body'->'replacing_push'->>'push_id', A.event->'body'->'replacing_push'->>'group_id') as replaces,
                NULL,
        FROM events as A WHERE (
                A.event@>$1 AND 
                app = $2  AND 
                -- excluding REGION and LOCATION events because I found that
                -- their volume overwhelms that of events indicating actual
                -- usage of the app. 
                NOT A.event@>'{"type": "REGION"}' AND
                NOT A.event@>'{"type": "LOCATION"}'
        )
        UNION
                -- Takes the set union of the pevious temporary table and
                -- a temporary table with each of the push body events 
                -- referenced in any way by the events in the first table
                SELECT 
                        B.event as message,
                        B.event->'occurred' as occurred,
                        NULL, -- no fulfills
                        NULL, -- no precedes
                        NULL, -- no triggers
                        NULL, -- no replaces
                        COALESCE(B.event->'body'->>'group_id', B.event->'body'->>'push_id') AS defines,
                FROM E, events as B WHERE (
                        B.event@>'{"type": "PUSH_BODY"}' AND
                        (
                                COALESCE(B.event->'body'->>'group_id', B.event->'body'->>'push_id') = E.fulfills OR
                                COALESCE(B.event->'body'->>'group_id', B.event->'body'->>'push_id') = E.precedes OR
                                COALESCE(B.event->'body'->>'group_id', B.event->'body'->>'push_id') = E.triggers OR
                                COALESCE(B.event->'body'->>'group_id', B.event->'body'->>'push_id') = E.replaces
                        ) 
                ) 
)
-- Return all the data, ordered by the occurred time. (note that we're sorting
-- lexicographically on the ISODATE. ISODATES are cool cause they let
-- you do that.
SELECT *
        FROM E
        ORDER BY occurred DESC
        LIMIT $3 OFFSET $4;
