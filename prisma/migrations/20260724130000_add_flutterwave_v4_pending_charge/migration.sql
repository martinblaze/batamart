-- Flutterwave v4 migration: direct-charge flow needs to bridge a synchronous
-- chargeId (returned when the charge is created) to the later, separate
-- request when the buyer lands back on /api/payments/verify after a 3D
-- Secure challenge. See prisma/schema.prisma PendingCharge model comment.

ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "flutterwaveCustomerId" TEXT;

CREATE TABLE IF NOT EXISTS "public"."PendingCharge" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "reference"     TEXT NOT NULL,
  "chargeId"      TEXT NOT NULL,
  "amount"        DOUBLE PRECISION NOT NULL,
  "cartItemsJson" JSONB NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PendingCharge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PendingCharge_reference_key"
  ON "public"."PendingCharge"("reference");

CREATE INDEX IF NOT EXISTS "PendingCharge_reference_idx"
  ON "public"."PendingCharge"("reference");

CREATE INDEX IF NOT EXISTS "PendingCharge_chargeId_idx"
  ON "public"."PendingCharge"("chargeId");

CREATE INDEX IF NOT EXISTS "PendingCharge_userId_idx"
  ON "public"."PendingCharge"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PendingCharge_userId_fkey'
  ) THEN
    ALTER TABLE "public"."PendingCharge"
      ADD CONSTRAINT "PendingCharge_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
