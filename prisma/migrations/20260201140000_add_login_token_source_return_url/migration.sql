-- AlterTable: add source and returnUrl to MemberLoginToken (context for verify redirect, no PII in email link)
ALTER TABLE "MemberLoginToken" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'fenam';
ALTER TABLE "MemberLoginToken" ADD COLUMN "returnUrl" TEXT;
