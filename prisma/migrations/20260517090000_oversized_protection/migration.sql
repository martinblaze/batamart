ALTER TABLE "public"."Product"
  ADD COLUMN "productDeliveryAgreement" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "moderationStatus" TEXT NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "estimatedWeightKg" DOUBLE PRECISION,
  ADD COLUMN "dimensionsCm" JSONB;

ALTER TABLE "public"."Order"
  ADD COLUMN "buyerDeliveryAcknowledged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "oversizedCancellationReason" TEXT;

CREATE TABLE "public"."SellerStrike" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "productId" TEXT,
  "orderId" TEXT,
  "strikeCount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "suspensionReason" TEXT,
  "suspensionExpiry" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerStrike_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."OversizedDeclineLog" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "riderId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "proofImageUrl" TEXT,
  "refundIssued" BOOLEAN NOT NULL DEFAULT false,
  "refundAmount" DOUBLE PRECISION,
  "deliveryFeeKept" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OversizedDeclineLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OversizedDeclineLog_orderId_riderId_key" ON "public"."OversizedDeclineLog"("orderId", "riderId");
CREATE INDEX "SellerStrike_sellerId_idx" ON "public"."SellerStrike"("sellerId");
CREATE INDEX "SellerStrike_createdAt_idx" ON "public"."SellerStrike"("createdAt");
CREATE INDEX "OversizedDeclineLog_sellerId_idx" ON "public"."OversizedDeclineLog"("sellerId");
CREATE INDEX "OversizedDeclineLog_productId_idx" ON "public"."OversizedDeclineLog"("productId");
CREATE INDEX "OversizedDeclineLog_createdAt_idx" ON "public"."OversizedDeclineLog"("createdAt");

ALTER TABLE "public"."SellerStrike"
  ADD CONSTRAINT "SellerStrike_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
