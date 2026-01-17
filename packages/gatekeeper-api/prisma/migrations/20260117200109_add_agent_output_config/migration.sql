-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LLMAgent" (
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
    "projectPath" TEXT NOT NULL DEFAULT '.',
    "generatePlanJson" BOOLEAN NOT NULL DEFAULT true,
    "generateLog" BOOLEAN NOT NULL DEFAULT true,
    "generateTaskPrompt" BOOLEAN NOT NULL DEFAULT true,
    "generateSpecFile" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_LLMAgent" ("apiKey", "apiKeyEnvVar", "baseUrl", "createdAt", "id", "isActive", "isDefault", "maxTokens", "model", "name", "provider", "slug", "sortOrder", "systemPromptId", "temperature", "updatedAt") SELECT "apiKey", "apiKeyEnvVar", "baseUrl", "createdAt", "id", "isActive", "isDefault", "maxTokens", "model", "name", "provider", "slug", "sortOrder", "systemPromptId", "temperature", "updatedAt" FROM "LLMAgent";
DROP TABLE "LLMAgent";
ALTER TABLE "new_LLMAgent" RENAME TO "LLMAgent";
CREATE UNIQUE INDEX "LLMAgent_name_key" ON "LLMAgent"("name");
CREATE UNIQUE INDEX "LLMAgent_slug_key" ON "LLMAgent"("slug");
CREATE INDEX "LLMAgent_provider_idx" ON "LLMAgent"("provider");
CREATE INDEX "LLMAgent_isActive_idx" ON "LLMAgent"("isActive");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
