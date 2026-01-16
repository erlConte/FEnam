-- AlterTable
ALTER TABLE "Affiliation" ADD COLUMN "memberNumber" TEXT;
ALTER TABLE "Affiliation" ADD COLUMN "membershipCardSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Affiliation_memberNumber_key" ON "Affiliation"("memberNumber");
