-- A query to get the unique devices matching $1, and the count of matching 
-- events. Parameters:

-- 1 json object to look for
-- 2 app
-- 3 limit 
-- 4 offset

SELECT event#>'{device}' as device, count(*) as count FROM events 
WHERE (app = $2 AND event#>$1 IS NOT NULL AND 
                        NOT event@>'{"type": "REGION"}' AND
                        NOT event@>'{"type": "LOCATION"}')
GROUP BY event#>$1, event#>'{device}'
ORDER BY count(*) DESC LIMIT $3 OFFSET $4;

