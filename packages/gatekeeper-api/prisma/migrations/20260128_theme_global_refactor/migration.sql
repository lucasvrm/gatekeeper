-- Theme Engine Global Refactor Migration
-- Remove projectId from Theme table and add unique constraint on name

-- Drop existing Theme table (SQLite doesn't support ALTER TABLE DROP COLUMN)
DROP TABLE IF EXISTS "Theme";

-- Recreate Theme table without projectId
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "presetRaw" TEXT NOT NULL,
    "cssVariables" TEXT NOT NULL,
    "layoutConfig" TEXT NOT NULL,
    "componentStyles" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Add unique constraint on name
CREATE UNIQUE INDEX "Theme_name_key" ON "Theme"("name");

-- Add index on isActive for performance
CREATE INDEX "Theme_isActive_idx" ON "Theme"("isActive");
