ALTER TABLE "public"."DeliveryBatch"
ADD COLUMN "gatewayFee" DOUBLE PRECISION,
ADD COLUMN "gatewayFeeEstimated" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."Transaction"
ADD COLUMN "gatewayFee" DOUBLE PRECISION,
ADD COLUMN "gatewayFeeEstimated" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "public"."Payment_transactionId_key";
