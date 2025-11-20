-- Rename table user_stats_99 to user_stats_gp
ALTER TABLE "user_stats_99" RENAME TO "user_stats_gp";

-- Update any indexes that might have the old table name
-- Prisma will handle index names automatically