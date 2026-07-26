ALTER TABLE "public"."Product"
  ADD COLUMN IF NOT EXISTS "campaignTag"       TEXT,
  ADD COLUMN IF NOT EXISTS "campaignExpiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Product_campaignTag_idx" ON "public"."Product"("campaignTag");
