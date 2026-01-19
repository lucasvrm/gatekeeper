-- AlterTable
ALTER TABLE "ValidationRun" ADD COLUMN "bypassedValidators" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ValidatorResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "gateNumber" INTEGER NOT NULL,
    "validatorCode" TEXT NOT NULL,
    "validatorName" TEXT NOT NULL,
    "validatorOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "isHardBlock" BOOLEAN NOT NULL DEFAULT true,
    "bypassed" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_ValidatorResult" ("completedAt", "createdAt", "details", "durationMs", "evidence", "gateNumber", "id", "isHardBlock", "message", "metrics", "passed", "runId", "startedAt", "status", "validatorCode", "validatorName", "validatorOrder") SELECT "completedAt", "createdAt", "details", "durationMs", "evidence", "gateNumber", "id", "isHardBlock", "message", "metrics", "passed", "runId", "startedAt", "status", "validatorCode", "validatorName", "validatorOrder" FROM "ValidatorResult";
DROP TABLE "ValidatorResult";
ALTER TABLE "new_ValidatorResult" RENAME TO "ValidatorResult";
CREATE INDEX "ValidatorResult_gateNumber_idx" ON "ValidatorResult"("gateNumber");
CREATE INDEX "ValidatorResult_validatorCode_idx" ON "ValidatorResult"("validatorCode");
CREATE INDEX "ValidatorResult_status_idx" ON "ValidatorResult"("status");
CREATE UNIQUE INDEX "ValidatorResult_runId_validatorCode_key" ON "ValidatorResult"("runId", "validatorCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
