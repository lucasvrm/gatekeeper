-- AlterTable
ALTER TABLE "ValidationRun" ADD COLUMN "commitHash" TEXT;
ALTER TABLE "ValidationRun" ADD COLUMN "commitMessage" TEXT;
ALTER TABLE "ValidationRun" ADD COLUMN "committedAt" DATETIME;

-- CreateTable
CREATE TABLE "UIContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "contractJson" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UIContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UIContract_projectId_key" ON "UIContract"("projectId");

-- CreateIndex
CREATE INDEX "UIContract_projectId_idx" ON "UIContract"("projectId");
