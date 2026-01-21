-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TestPathConvention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL DEFAULT '__global__',
    "testType" TEXT NOT NULL,
    "pathPattern" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TestPathConvention_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TestPathConvention" ("createdAt", "description", "id", "isActive", "pathPattern", "testType", "updatedAt", "workspaceId") SELECT "createdAt", "description", "id", "isActive", "pathPattern", "testType", "updatedAt", coalesce("workspaceId", '__global__') AS "workspaceId" FROM "TestPathConvention";
DROP TABLE "TestPathConvention";
ALTER TABLE "new_TestPathConvention" RENAME TO "TestPathConvention";
CREATE INDEX "TestPathConvention_workspaceId_idx" ON "TestPathConvention"("workspaceId");
CREATE UNIQUE INDEX "TestPathConvention_workspaceId_testType_key" ON "TestPathConvention"("workspaceId", "testType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
