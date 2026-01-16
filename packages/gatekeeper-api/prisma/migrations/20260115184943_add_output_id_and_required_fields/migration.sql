-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outputId" TEXT NOT NULL,
    "projectPath" TEXT NOT NULL,
    "baseRef" TEXT NOT NULL DEFAULT 'origin/main',
    "targetRef" TEXT NOT NULL DEFAULT 'HEAD',
    "taskPrompt" TEXT NOT NULL,
    "manifestJson" TEXT NOT NULL,
    "testFilePath" TEXT NOT NULL,
    "dangerMode" BOOLEAN NOT NULL DEFAULT false,
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

-- CreateTable
CREATE TABLE "GateResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "gateNumber" INTEGER NOT NULL,
    "gateName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "totalValidators" INTEGER NOT NULL DEFAULT 0,
    "passedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GateResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ValidationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidatorResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "gateNumber" INTEGER NOT NULL,
    "validatorCode" TEXT NOT NULL,
    "validatorName" TEXT NOT NULL,
    "validatorOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "isHardBlock" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT,
    "details" TEXT,
    "evidence" TEXT,
    "metrics" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidatorResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ValidationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "gateNumber" INTEGER,
    "validator" TEXT,
    "metadata" TEXT,
    "stackTrace" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ValidationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManifestFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "wasModified" BOOLEAN NOT NULL DEFAULT false,
    "inDiff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManifestFile_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ValidationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SensitiveFileRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pattern" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'BLOCK',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AmbiguousTerm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "suggestion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ValidationConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NUMBER',
    "category" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ValidationRun_status_idx" ON "ValidationRun"("status");

-- CreateIndex
CREATE INDEX "ValidationRun_createdAt_idx" ON "ValidationRun"("createdAt");

-- CreateIndex
CREATE INDEX "ValidationRun_projectPath_idx" ON "ValidationRun"("projectPath");

-- CreateIndex
CREATE INDEX "ValidationRun_outputId_idx" ON "ValidationRun"("outputId");

-- CreateIndex
CREATE INDEX "GateResult_gateNumber_idx" ON "GateResult"("gateNumber");

-- CreateIndex
CREATE INDEX "GateResult_status_idx" ON "GateResult"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GateResult_runId_gateNumber_key" ON "GateResult"("runId", "gateNumber");

-- CreateIndex
CREATE INDEX "ValidatorResult_gateNumber_idx" ON "ValidatorResult"("gateNumber");

-- CreateIndex
CREATE INDEX "ValidatorResult_validatorCode_idx" ON "ValidatorResult"("validatorCode");

-- CreateIndex
CREATE INDEX "ValidatorResult_status_idx" ON "ValidatorResult"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ValidatorResult_runId_validatorCode_key" ON "ValidatorResult"("runId", "validatorCode");

-- CreateIndex
CREATE INDEX "ValidationLog_runId_idx" ON "ValidationLog"("runId");

-- CreateIndex
CREATE INDEX "ValidationLog_level_idx" ON "ValidationLog"("level");

-- CreateIndex
CREATE INDEX "ValidationLog_timestamp_idx" ON "ValidationLog"("timestamp");

-- CreateIndex
CREATE INDEX "ManifestFile_runId_idx" ON "ManifestFile"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "ManifestFile_runId_filePath_key" ON "ManifestFile"("runId", "filePath");

-- CreateIndex
CREATE UNIQUE INDEX "SensitiveFileRule_pattern_key" ON "SensitiveFileRule"("pattern");

-- CreateIndex
CREATE UNIQUE INDEX "AmbiguousTerm_term_key" ON "AmbiguousTerm"("term");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationConfig_key_key" ON "ValidationConfig"("key");
