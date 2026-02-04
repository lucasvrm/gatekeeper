/*
  Warnings:

  - You are about to drop the `OrchestratorContent` table. If the table is not empty, all the data it contains will be lost.
  - The primary key for the `AgentPhaseConfig` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `AgentPhaseConfig` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `AgentPhaseConfig` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "OrchestratorContent_step_kind_name_key";

-- DropIndex
DROP INDEX "OrchestratorContent_step_kind_isActive_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "OrchestratorContent";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AgentPhaseConfig" (
    "step" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-5-20250929',
    "maxTokens" INTEGER NOT NULL DEFAULT 8192,
    "maxIterations" INTEGER NOT NULL DEFAULT 30,
    "maxInputTokensBudget" INTEGER NOT NULL DEFAULT 0,
    "temperature" REAL,
    "fallbackProvider" TEXT,
    "fallbackModel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AgentPhaseConfig" ("createdAt", "fallbackModel", "fallbackProvider", "maxIterations", "maxTokens", "model", "provider", "step", "temperature", "updatedAt") SELECT "createdAt", "fallbackModel", "fallbackProvider", "maxIterations", "maxTokens", "model", "provider", "step", "temperature", "updatedAt" FROM "AgentPhaseConfig";
DROP TABLE "AgentPhaseConfig";
ALTER TABLE "new_AgentPhaseConfig" RENAME TO "AgentPhaseConfig";
CREATE TABLE "new_PromptInstruction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'instruction',
    "step" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PromptInstruction" ("content", "createdAt", "id", "isActive", "name", "updatedAt") SELECT "content", "createdAt", "id", "isActive", "name", "updatedAt" FROM "PromptInstruction";
DROP TABLE "PromptInstruction";
ALTER TABLE "new_PromptInstruction" RENAME TO "PromptInstruction";
CREATE UNIQUE INDEX "PromptInstruction_name_key" ON "PromptInstruction"("name");
CREATE INDEX "PromptInstruction_step_kind_order_idx" ON "PromptInstruction"("step", "kind", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
