/*
  Warnings:

  - A unique constraint covering the columns `[step,kind,name]` on the table `OrchestratorContent` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "OrchestratorContent_kind_step_name_key";

-- DropIndex
DROP INDEX "OrchestratorContent_isActive_idx";

-- DropIndex
DROP INDEX "OrchestratorContent_kind_step_idx";

-- CreateTable
CREATE TABLE "AgentPhaseConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "step" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-5-20250929',
    "maxTokens" INTEGER NOT NULL DEFAULT 8192,
    "maxIterations" INTEGER NOT NULL DEFAULT 30,
    "temperature" REAL,
    "fallbackProvider" TEXT,
    "fallbackModel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentPhaseConfig_step_key" ON "AgentPhaseConfig"("step");

-- CreateIndex
CREATE INDEX "OrchestratorContent_step_kind_isActive_idx" ON "OrchestratorContent"("step", "kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OrchestratorContent_step_kind_name_key" ON "OrchestratorContent"("step", "kind", "name");
