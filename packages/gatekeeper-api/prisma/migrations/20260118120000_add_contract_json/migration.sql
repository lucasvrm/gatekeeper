-- Alter ValidationRun to store contract JSON
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
ALTER TABLE "ValidationRun" ADD COLUMN "contractJson" TEXT;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
