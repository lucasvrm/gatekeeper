-- Remove Theme and UIContract tables

-- Drop Theme indexes before table removal
DROP INDEX IF EXISTS "Theme_name_key";
DROP INDEX IF EXISTS "Theme_isActive_idx";
DROP TABLE IF EXISTS "Theme";

-- Drop UIContract indexes before table removal
DROP INDEX IF EXISTS "UIContract_projectId_key";
DROP INDEX IF EXISTS "UIContract_projectId_idx";
DROP TABLE IF EXISTS "UIContract";
