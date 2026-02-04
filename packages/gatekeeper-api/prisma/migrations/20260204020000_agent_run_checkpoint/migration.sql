-- AlterTable: Add checkpoint/resume fields to AgentRun
ALTER TABLE "AgentRun" ADD COLUMN "outputId" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "lastCompletedStep" INTEGER NOT NULL DEFAULT 0;
