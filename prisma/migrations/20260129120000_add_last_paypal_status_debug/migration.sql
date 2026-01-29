-- AlterTable
ALTER TABLE "Affiliation" ADD COLUMN "lastPaypalStatus" TEXT,
ADD COLUMN "lastPaypalCheckedAt" TIMESTAMP(3);
