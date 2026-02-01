-- CreateTable
CREATE TABLE "MemberLoginToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "affiliationId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestIp" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "MemberLoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberLoginToken_tokenHash_key" ON "MemberLoginToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "MemberLoginToken" ADD CONSTRAINT "MemberLoginToken_affiliationId_fkey" FOREIGN KEY ("affiliationId") REFERENCES "Affiliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
