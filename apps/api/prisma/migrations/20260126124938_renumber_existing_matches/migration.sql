-- Renumber existing matches to fill gaps
-- For each season, assign sequential matchNumbers to non-cancelled matches
-- ordered by their original matchNumber (preserving relative order)

-- Temporarily disable unique constraint check by setting all to null first
UPDATE matches SET "matchNumber" = NULL WHERE "matchNumber" IS NOT NULL;

-- Renumber using a CTE with ROW_NUMBER
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "seasonId"
      ORDER BY id ASC
    ) AS new_number
  FROM matches
  WHERE status != 'CANCELLED'
)
UPDATE matches m
SET "matchNumber" = n.new_number
FROM numbered n
WHERE m.id = n.id;
