-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ElicitationSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outputId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "initialPrompt" TEXT NOT NULL,
    "detectedType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "maxRounds" INTEGER NOT NULL DEFAULT 10,
    "completenessScore" INTEGER,
    "missingFields" TEXT,
    "contractState" TEXT,
    "taskPrompt" TEXT,
    "planJson" TEXT,
    "totalTokensIn" INTEGER NOT NULL DEFAULT 0,
    "totalTokensOut" INTEGER NOT NULL DEFAULT 0,
    "totalDurationMs" INTEGER,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ElicitationSession_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "LLMAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ElicitationSession" ("agentId", "completedAt", "completenessScore", "contractState", "createdAt", "currentRound", "detectedType", "id", "initialPrompt", "maxRounds", "missingFields", "outputId", "planJson", "startedAt", "status", "taskPrompt", "totalDurationMs", "totalTokensIn", "totalTokensOut", "updatedAt") SELECT "agentId", "completedAt", "completenessScore", "contractState", "createdAt", "currentRound", "detectedType", "id", "initialPrompt", "maxRounds", "missingFields", "outputId", "planJson", "startedAt", "status", "taskPrompt", "totalDurationMs", "totalTokensIn", "totalTokensOut", "updatedAt" FROM "ElicitationSession";
DROP TABLE "ElicitationSession";
ALTER TABLE "new_ElicitationSession" RENAME TO "ElicitationSession";
CREATE UNIQUE INDEX "ElicitationSession_outputId_key" ON "ElicitationSession"("outputId");
CREATE INDEX "ElicitationSession_status_idx" ON "ElicitationSession"("status");
CREATE INDEX "ElicitationSession_detectedType_idx" ON "ElicitationSession"("detectedType");
CREATE INDEX "ElicitationSession_agentId_idx" ON "ElicitationSession"("agentId");
CREATE INDEX "ElicitationSession_createdAt_idx" ON "ElicitationSession"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
