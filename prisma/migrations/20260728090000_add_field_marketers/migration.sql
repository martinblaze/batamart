CREATE TABLE IF NOT EXISTS "public"."FieldMarketer" (
  "id"           TEXT         NOT NULL,
  "userId"       TEXT         NOT NULL,
  "code"         TEXT         NOT NULL,
  "totalSignups" INTEGER      NOT NULL DEFAULT 0,
  "totalEarned"  INTEGER      NOT NULL DEFAULT 0,
  "balance"      INTEGER      NOT NULL DEFAULT 0,
  "joinedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FieldMarketer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."FieldMarketerSignup" (
  "id"             TEXT         NOT NULL,
  "marketerId"     TEXT         NOT NULL,
  "referredUserId" TEXT         NOT NULL,
  "amount"         INTEGER      NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FieldMarketerSignup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FieldMarketer_userId_key" ON "public"."FieldMarketer"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "FieldMarketer_code_key" ON "public"."FieldMarketer"("code");
CREATE INDEX IF NOT EXISTS "FieldMarketer_totalSignups_idx" ON "public"."FieldMarketer"("totalSignups");
CREATE UNIQUE INDEX IF NOT EXISTS "FieldMarketerSignup_referredUserId_key" ON "public"."FieldMarketerSignup"("referredUserId");
CREATE INDEX IF NOT EXISTS "FieldMarketerSignup_marketerId_idx" ON "public"."FieldMarketerSignup"("marketerId");
CREATE INDEX IF NOT EXISTS "FieldMarketerSignup_createdAt_idx" ON "public"."FieldMarketerSignup"("createdAt");

ALTER TABLE "public"."FieldMarketer" ADD CONSTRAINT "FieldMarketer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."FieldMarketerSignup" ADD CONSTRAINT "FieldMarketerSignup_marketerId_fkey"
  FOREIGN KEY ("marketerId") REFERENCES "public"."FieldMarketer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."FieldMarketerSignup" ADD CONSTRAINT "FieldMarketerSignup_referredUserId_fkey"
  FOREIGN KEY ("referredUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
