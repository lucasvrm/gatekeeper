-- CreateTable
CREATE TABLE "TestPathConvention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testType" TEXT NOT NULL,
    "pathPattern" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TestPathConvention_testType_key" ON "TestPathConvention"("testType");
