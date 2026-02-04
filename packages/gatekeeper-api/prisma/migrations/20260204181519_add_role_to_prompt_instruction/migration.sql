-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PromptInstruction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "step" INTEGER,
    "kind" TEXT,
    "role" TEXT NOT NULL DEFAULT 'system',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PromptInstruction" ("content", "createdAt", "id", "isActive", "kind", "name", "order", "step", "updatedAt") SELECT "content", "createdAt", "id", "isActive", "kind", "name", "order", "step", "updatedAt" FROM "PromptInstruction";
DROP TABLE "PromptInstruction";
ALTER TABLE "new_PromptInstruction" RENAME TO "PromptInstruction";
CREATE UNIQUE INDEX "PromptInstruction_name_key" ON "PromptInstruction"("name");
CREATE INDEX "PromptInstruction_step_kind_role_isActive_idx" ON "PromptInstruction"("step", "kind", "role", "isActive");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
