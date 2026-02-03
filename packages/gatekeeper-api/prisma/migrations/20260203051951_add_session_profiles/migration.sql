-- CreateTable
CREATE TABLE "ValidatorMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "gate" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "isHardBlock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SessionProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "taskType" TEXT NOT NULL DEFAULT 'feature',
    "gitStrategy" TEXT NOT NULL DEFAULT 'main',
    "branch" TEXT,
    "docsDir" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SessionProfilePrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionProfilePrompt_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SessionProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionProfilePrompt_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "PromptInstruction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ValidatorMetadata_code_key" ON "ValidatorMetadata"("code");

-- CreateIndex
CREATE INDEX "ValidatorMetadata_category_idx" ON "ValidatorMetadata"("category");

-- CreateIndex
CREATE INDEX "ValidatorMetadata_gate_idx" ON "ValidatorMetadata"("gate");

-- CreateIndex
CREATE UNIQUE INDEX "SessionProfile_name_key" ON "SessionProfile"("name");

-- CreateIndex
CREATE INDEX "SessionProfile_name_idx" ON "SessionProfile"("name");

-- CreateIndex
CREATE INDEX "SessionProfilePrompt_profileId_idx" ON "SessionProfilePrompt"("profileId");

-- CreateIndex
CREATE INDEX "SessionProfilePrompt_promptId_idx" ON "SessionProfilePrompt"("promptId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionProfilePrompt_profileId_promptId_key" ON "SessionProfilePrompt"("profileId", "promptId");
