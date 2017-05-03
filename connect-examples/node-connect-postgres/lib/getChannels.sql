-- 1 key
-- 2 limit
-- 3 offset
-- 4 app

SELECT event#>'{device}' as device, count(*) as count FROM events 
WHERE app = $2 AND event#>$1 IS NOT NULL
GROUP BY event#>$1, event#>'{device}'
ORDER BY count(*) DESC LIMIT $3 OFFSET $4;

