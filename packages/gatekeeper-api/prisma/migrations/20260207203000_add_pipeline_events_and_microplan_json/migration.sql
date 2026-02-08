-- AlterTable
ALTER TABLE "ValidationRun" ADD COLUMN "microplanJson" TEXT;

-- CreateTable
CREATE TABLE "PipelineEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "outputId" TEXT NOT NULL,
    "runId" TEXT,
    "agentRunId" TEXT,
    "stage" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "level" TEXT,
    "message" TEXT,
    "payload" TEXT,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PipelineState" (
    "outputId" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'running',
    "stage" TEXT NOT NULL DEFAULT 'planning',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "lastEventId" INTEGER NOT NULL DEFAULT 0,
    "agentRunId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PipelineEvent_outputId_id_idx" ON "PipelineEvent"("outputId", "id");

-- CreateIndex
CREATE INDEX "PipelineEvent_outputId_createdAt_idx" ON "PipelineEvent"("outputId", "createdAt");

-- CreateIndex
CREATE INDEX "PipelineEvent_outputId_stage_idx" ON "PipelineEvent"("outputId", "stage");
