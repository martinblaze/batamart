ALTER TYPE "public"."OrderStatus" ADD VALUE IF NOT EXISTS 'AT_HUB';
ALTER TYPE "public"."OrderStatus" ADD VALUE IF NOT EXISTS 'PACKED';

ALTER TABLE "public"."Order" ADD COLUMN IF NOT EXISTS "hubReceivedAt" TIMESTAMP(3);
ALTER TABLE "public"."Order" ADD COLUMN IF NOT EXISTS "packedAt" TIMESTAMP(3);
ALTER TABLE "public"."Order" ADD COLUMN IF NOT EXISTS "bagLabel" TEXT;
ALTER TABLE "public"."Order" ADD COLUMN IF NOT EXISTS "deliveryRiderId" TEXT;
ALTER TABLE "public"."Order" ADD COLUMN IF NOT EXISTS "deferredUntil" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_deliveryRiderId_idx" ON "public"."Order"("deliveryRiderId");
