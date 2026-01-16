-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ValidationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outputId" TEXT NOT NULL,
    "projectPath" TEXT NOT NULL,
    "baseRef" TEXT NOT NULL DEFAULT 'origin/main',
    "targetRef" TEXT NOT NULL DEFAULT 'HEAD',
    "taskPrompt" TEXT NOT NULL,
    "manifestJson" TEXT NOT NULL,
    "testFilePath" TEXT NOT NULL,
    "dangerMode" BOOLEAN NOT NULL DEFAULT false,
    "runType" TEXT NOT NULL DEFAULT 'CONTRACT',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentGate" INTEGER NOT NULL DEFAULT 0,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "failedAt" INTEGER,
    "summary" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ValidationRun" ("baseRef", "completedAt", "createdAt", "currentGate", "dangerMode", "failedAt", "id", "manifestJson", "outputId", "passed", "projectPath", "startedAt", "status", "summary", "targetRef", "taskPrompt", "testFilePath", "updatedAt") SELECT "baseRef", "completedAt", "createdAt", "currentGate", "dangerMode", "failedAt", "id", "manifestJson", "outputId", "passed", "projectPath", "startedAt", "status", "summary", "targetRef", "taskPrompt", "testFilePath", "updatedAt" FROM "ValidationRun";
DROP TABLE "ValidationRun";
ALTER TABLE "new_ValidationRun" RENAME TO "ValidationRun";
CREATE INDEX "ValidationRun_status_idx" ON "ValidationRun"("status");
CREATE INDEX "ValidationRun_createdAt_idx" ON "ValidationRun"("createdAt");
CREATE INDEX "ValidationRun_projectPath_idx" ON "ValidationRun"("projectPath");
CREATE INDEX "ValidationRun_outputId_idx" ON "ValidationRun"("outputId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
