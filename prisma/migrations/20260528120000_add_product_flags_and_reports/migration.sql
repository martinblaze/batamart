ALTER TABLE "public"."Product"
  ADD COLUMN IF NOT EXISTS "isFlagged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "flagReason" TEXT;

CREATE TABLE IF NOT EXISTS "public"."ProductReport" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductReport_userId_productId_key"
  ON "public"."ProductReport"("userId", "productId");

CREATE INDEX IF NOT EXISTS "ProductReport_productId_idx"
  ON "public"."ProductReport"("productId");

CREATE INDEX IF NOT EXISTS "ProductReport_userId_idx"
  ON "public"."ProductReport"("userId");

CREATE INDEX IF NOT EXISTS "Product_isFlagged_idx"
  ON "public"."Product"("isFlagged");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProductReport_productId_fkey'
  ) THEN
    ALTER TABLE "public"."ProductReport"
      ADD CONSTRAINT "ProductReport_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "public"."Product"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProductReport_userId_fkey'
  ) THEN
    ALTER TABLE "public"."ProductReport"
      ADD CONSTRAINT "ProductReport_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
