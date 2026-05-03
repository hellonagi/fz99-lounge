-- Create Unrated seasons (seasonNumber=-1) for GP and TEAM_GP categories
INSERT INTO "seasons" ("eventId", "seasonNumber", "isActive", "startDate", "createdAt", "updatedAt")
SELECT e.id, -1, true, NOW(), NOW(), NOW()
FROM "events" e
WHERE e.category IN ('GP', 'TEAM_GP')
AND NOT EXISTS (
  SELECT 1 FROM "seasons" s WHERE s."eventId" = e.id AND s."seasonNumber" = -1
);

-- Lower minPlayers from 30 to 10 for existing GP/TEAM_GP recurring matches
UPDATE "recurring_matches"
SET "minPlayers" = 10
WHERE "eventCategory" IN ('GP', 'TEAM_GP')
AND "minPlayers" = 30;
