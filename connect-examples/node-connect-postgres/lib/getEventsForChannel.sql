-- 1 device object match
-- 3 limit
-- 4 offset
-- 5 app

-- All the events pertaining to the specified user/device
WITH RECURSIVE E AS (
                SELECT
                        A.event as message,
                        A.event->'occurred' as occurred,
                        COALESCE(A.event->'body'->>'group_id', A.event->'body'->>'push_id') AS fulfills,
                        COALESCE(A.event->'body'->'last_delivered'->>'push_id', A.event->'body'->'last_delivered'->>'group_id') as precedes,
                        COALESCE(A.event->'body'->'triggering_push'->>'push_id', A.event->'body'->'triggering_push'->>'group_id') as triggers,
                        COALESCE(A.event->'body'->'replacing_push'->>'push_id', A.event->'body'->'replacing_push'->>'group_id') as replaces,
                        NULL,
                        A.event->'device'->'named_user_id' AS device,
                        A.event->'type' as event_type,
                        A.event->'id' as id
                        
                FROM events as A WHERE A.event@>$1 AND app = $2
        UNION
                SELECT 
                        B.event as message,
                        B.event->'occurred' as occurred,
                        NULL, -- no fulfills
                        NULL, -- no precedes
                        NULL, -- no triggers
                        NULL, -- no replaces
                        COALESCE(B.event->'body'->>'group_id', B.event->'body'->>'push_id') AS defines,
                        NULL, -- no device
                        B.event->'type' as event_type,
                        B.event->'id' as id
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
SELECT *
        FROM E
        ORDER BY occurred DESC
        LIMIT $3 OFFSET $4;
