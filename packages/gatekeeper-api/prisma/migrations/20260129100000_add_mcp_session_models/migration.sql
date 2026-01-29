-- CreateTable
CREATE TABLE "Snippet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "content" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContextPack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "files" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SessionPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SessionHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskType" TEXT NOT NULL,
    "gitStrategy" TEXT NOT NULL,
    "branch" TEXT,
    "projectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "runIds" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MCPSessionConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "config" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Snippet_name_key" ON "Snippet"("name");

-- CreateIndex
CREATE INDEX "Snippet_category_idx" ON "Snippet"("category");

-- CreateIndex
CREATE INDEX "Snippet_name_idx" ON "Snippet"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ContextPack_name_key" ON "ContextPack"("name");

-- CreateIndex
CREATE INDEX "ContextPack_name_idx" ON "ContextPack"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SessionPreset_name_key" ON "SessionPreset"("name");

-- CreateIndex
CREATE INDEX "SessionPreset_name_idx" ON "SessionPreset"("name");

-- CreateIndex
CREATE INDEX "SessionHistory_status_idx" ON "SessionHistory"("status");

-- CreateIndex
CREATE INDEX "SessionHistory_createdAt_idx" ON "SessionHistory"("createdAt");
