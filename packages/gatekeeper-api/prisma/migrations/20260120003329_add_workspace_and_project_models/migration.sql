-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rootPath" TEXT NOT NULL,
    "artifactsDir" TEXT NOT NULL DEFAULT 'artifacts',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseRef" TEXT NOT NULL DEFAULT 'origin/main',
    "targetRef" TEXT NOT NULL DEFAULT 'HEAD',
    "backendWorkspace" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkspaceConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'STRING',
    "category" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TestPathConvention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT,
    "testType" TEXT NOT NULL,
    "pathPattern" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TestPathConvention_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TestPathConvention" ("createdAt", "description", "id", "isActive", "pathPattern", "testType", "updatedAt") SELECT "createdAt", "description", "id", "isActive", "pathPattern", "testType", "updatedAt" FROM "TestPathConvention";
DROP TABLE "TestPathConvention";
ALTER TABLE "new_TestPathConvention" RENAME TO "TestPathConvention";
CREATE INDEX "TestPathConvention_workspaceId_idx" ON "TestPathConvention"("workspaceId");
CREATE UNIQUE INDEX "TestPathConvention_workspaceId_testType_key" ON "TestPathConvention"("workspaceId", "testType");
CREATE TABLE "new_ValidationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "outputId" TEXT NOT NULL,
    "projectPath" TEXT NOT NULL,
    "baseRef" TEXT NOT NULL DEFAULT 'origin/main',
    "targetRef" TEXT NOT NULL DEFAULT 'HEAD',
    "taskPrompt" TEXT NOT NULL,
    "manifestJson" TEXT NOT NULL,
    "testFilePath" TEXT NOT NULL,
    "dangerMode" BOOLEAN NOT NULL DEFAULT false,
    "runType" TEXT NOT NULL DEFAULT 'CONTRACT',
    "contractRunId" TEXT,
    "contractJson" TEXT,
    "bypassedValidators" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentGate" INTEGER NOT NULL DEFAULT 0,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "failedAt" INTEGER,
    "failedValidatorCode" TEXT,
    "summary" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ValidationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ValidationRun_contractRunId_fkey" FOREIGN KEY ("contractRunId") REFERENCES "ValidationRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ValidationRun" ("baseRef", "bypassedValidators", "completedAt", "contractJson", "contractRunId", "createdAt", "currentGate", "dangerMode", "failedAt", "failedValidatorCode", "id", "manifestJson", "outputId", "passed", "projectPath", "runType", "startedAt", "status", "summary", "targetRef", "taskPrompt", "testFilePath", "updatedAt") SELECT "baseRef", "bypassedValidators", "completedAt", "contractJson", "contractRunId", "createdAt", "currentGate", "dangerMode", "failedAt", "failedValidatorCode", "id", "manifestJson", "outputId", "passed", "projectPath", "runType", "startedAt", "status", "summary", "targetRef", "taskPrompt", "testFilePath", "updatedAt" FROM "ValidationRun";
DROP TABLE "ValidationRun";
ALTER TABLE "new_ValidationRun" RENAME TO "ValidationRun";
CREATE INDEX "ValidationRun_projectId_idx" ON "ValidationRun"("projectId");
CREATE INDEX "ValidationRun_status_idx" ON "ValidationRun"("status");
CREATE INDEX "ValidationRun_createdAt_idx" ON "ValidationRun"("createdAt");
CREATE INDEX "ValidationRun_projectPath_idx" ON "ValidationRun"("projectPath");
CREATE INDEX "ValidationRun_outputId_idx" ON "ValidationRun"("outputId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_name_key" ON "Workspace"("name");

-- CreateIndex
CREATE INDEX "Workspace_isActive_idx" ON "Workspace"("isActive");

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE INDEX "Project_isActive_idx" ON "Project"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Project_workspaceId_name_key" ON "Project"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "WorkspaceConfig_workspaceId_idx" ON "WorkspaceConfig"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceConfig_workspaceId_key_key" ON "WorkspaceConfig"("workspaceId", "key");
