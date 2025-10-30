-- AlterTable
ALTER TABLE "users" ADD COLUMN     "clearanceLevel" INTEGER DEFAULT 1,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "tenantId" TEXT;

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "users_department_idx" ON "users"("department");
