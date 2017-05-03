-- 1 device object match
-- 3 limit
-- 4 offset
-- 5 app

SELECT event FROM events WHERE (event@>$1 AND app=$2) 
GROUP BY id, app 
ORDER BY occurred DESC LIMIT $3 OFFSET $4;
        
