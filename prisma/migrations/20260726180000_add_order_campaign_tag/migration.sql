ALTER TABLE "public"."Order"
  ADD COLUMN IF NOT EXISTS "campaignTag" TEXT;

CREATE INDEX IF NOT EXISTS "Order_campaignTag_idx" ON "public"."Order"("campaignTag");
