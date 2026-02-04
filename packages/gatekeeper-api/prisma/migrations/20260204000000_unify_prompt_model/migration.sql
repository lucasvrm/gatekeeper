-- =============================================================================
-- Migration: Unify Prompt Model + Token Budget + Agent Run Persistence
-- =============================================================================

-- 1. Add step, kind, order fields to PromptInstruction
ALTER TABLE "PromptInstruction" ADD COLUMN "step" INTEGER;
ALTER TABLE "PromptInstruction" ADD COLUMN "kind" TEXT;
ALTER TABLE "PromptInstruction" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- 2. Migrate existing OrchestratorContent data into PromptInstruction
INSERT INTO "PromptInstruction" ("id", "name", "content", "step", "kind", "order", "isActive", "createdAt", "updatedAt")
SELECT
  "id",
  "name",
  "content",
  "step",
  "kind",
  "order",
  "isActive",
  "createdAt",
  "updatedAt"
FROM "OrchestratorContent"
WHERE "name" NOT IN (SELECT "name" FROM "PromptInstruction");

-- 3. Drop OrchestratorContent table
DROP TABLE IF EXISTS "OrchestratorContent";

-- 4. Create index for pipeline prompt queries
CREATE INDEX "PromptInstruction_step_kind_isActive_idx" ON "PromptInstruction"("step", "kind", "isActive");

-- 5. Add maxInputTokensBudget to AgentPhaseConfig
ALTER TABLE "AgentPhaseConfig" ADD COLUMN "maxInputTokensBudget" INTEGER NOT NULL DEFAULT 0;

-- 6. Create AgentRun table
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskDescription" TEXT NOT NULL,
    "projectPath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "totalInputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" REAL NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

CREATE INDEX "AgentRun_status_idx" ON "AgentRun"("status");
CREATE INDEX "AgentRun_startedAt_idx" ON "AgentRun"("startedAt");

-- 7. Create AgentRunStep table
CREATE TABLE "AgentRunStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" REAL NOT NULL DEFAULT 0,
    "iterations" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "AgentRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AgentRunStep_runId_idx" ON "AgentRunStep"("runId");
CREATE INDEX "AgentRunStep_runId_step_idx" ON "AgentRunStep"("runId", "step");
