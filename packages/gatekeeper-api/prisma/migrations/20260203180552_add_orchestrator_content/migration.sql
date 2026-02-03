-- CreateTable
CREATE TABLE "OrchestratorContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "OrchestratorContent_kind_step_idx" ON "OrchestratorContent"("kind", "step");

-- CreateIndex
CREATE INDEX "OrchestratorContent_isActive_idx" ON "OrchestratorContent"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OrchestratorContent_kind_step_name_key" ON "OrchestratorContent"("kind", "step", "name");
