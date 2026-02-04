-- =============================================================================
-- Migration: Agent Run Persistence Tables
-- =============================================================================
-- NOTE: PromptInstruction unification (step, kind, order columns) and
-- OrchestratorContent drop were already applied in migration
-- 20260203235043_agent_phase_config_and_prompt_fields.
-- This migration only adds the AgentRun tracking tables.

-- 1. Create AgentRun table
CREATE TABLE IF NOT EXISTS "AgentRun" (
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

CREATE INDEX IF NOT EXISTS "AgentRun_status_idx" ON "AgentRun"("status");
CREATE INDEX IF NOT EXISTS "AgentRun_startedAt_idx" ON "AgentRun"("startedAt");

-- 2. Create AgentRunStep table
CREATE TABLE IF NOT EXISTS "AgentRunStep" (
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

CREATE INDEX IF NOT EXISTS "AgentRunStep_runId_idx" ON "AgentRunStep"("runId");
CREATE INDEX IF NOT EXISTS "AgentRunStep_runId_step_idx" ON "AgentRunStep"("runId", "step");