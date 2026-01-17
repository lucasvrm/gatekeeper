-- CreateTable
CREATE TABLE "LLMAgent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "apiKey" TEXT,
    "apiKeyEnvVar" TEXT,
    "baseUrl" TEXT,
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "systemPromptId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ElicitationSession" (
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
    CONSTRAINT "ElicitationSession_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "LLMAgent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ElicitationMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "durationMs" INTEGER,
    "questionId" TEXT,
    "wasDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ElicitationMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ElicitationSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LLMAgent_name_key" ON "LLMAgent"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LLMAgent_slug_key" ON "LLMAgent"("slug");

-- CreateIndex
CREATE INDEX "LLMAgent_provider_idx" ON "LLMAgent"("provider");

-- CreateIndex
CREATE INDEX "LLMAgent_isActive_idx" ON "LLMAgent"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ElicitationSession_outputId_key" ON "ElicitationSession"("outputId");

-- CreateIndex
CREATE INDEX "ElicitationSession_status_idx" ON "ElicitationSession"("status");

-- CreateIndex
CREATE INDEX "ElicitationSession_detectedType_idx" ON "ElicitationSession"("detectedType");

-- CreateIndex
CREATE INDEX "ElicitationSession_agentId_idx" ON "ElicitationSession"("agentId");

-- CreateIndex
CREATE INDEX "ElicitationSession_createdAt_idx" ON "ElicitationSession"("createdAt");

-- CreateIndex
CREATE INDEX "ElicitationMessage_sessionId_idx" ON "ElicitationMessage"("sessionId");

-- CreateIndex
CREATE INDEX "ElicitationMessage_role_idx" ON "ElicitationMessage"("role");

-- CreateIndex
CREATE INDEX "ElicitationMessage_round_idx" ON "ElicitationMessage"("round");
