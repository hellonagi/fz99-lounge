-- Create Unrated seasons (seasonNumber=-1) for CLASSIC and TEAM_CLASSIC categories
INSERT INTO "seasons" ("eventId", "seasonNumber", "isActive", "startDate", "createdAt", "updatedAt")
SELECT e.id, -1, true, NOW(), NOW(), NOW()
FROM "events" e
WHERE e.category IN ('CLASSIC', 'TEAM_CLASSIC')
AND NOT EXISTS (
  SELECT 1 FROM "seasons" s WHERE s."eventId" = e.id AND s."seasonNumber" = -1
);
