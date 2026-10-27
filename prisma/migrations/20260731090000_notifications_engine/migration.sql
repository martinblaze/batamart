ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'DEAL_ALERT';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'REMINDER';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'WALLET_ACTIVITY';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'SECURITY_ALERT';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'WELCOME';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'PROMO';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_UPDATE';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'DIGEST';

CREATE TABLE IF NOT EXISTS "public"."DeviceToken" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'android',
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceToken_token_key" ON "public"."DeviceToken"("token");
CREATE INDEX IF NOT EXISTS "DeviceToken_userId_idx" ON "public"."DeviceToken"("userId");
DO $$ BEGIN
  ALTER TABLE "public"."DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "public"."NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "reminders" BOOLEAN NOT NULL DEFAULT true,
  "deals" BOOLEAN NOT NULL DEFAULT true,
  "marketing" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_key" ON "public"."NotificationPreference"("userId");
DO $$ BEGIN
  ALTER TABLE "public"."NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "public"."NotificationLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationLog_userId_key_key" ON "public"."NotificationLog"("userId", "key");
CREATE INDEX IF NOT EXISTS "NotificationLog_createdAt_idx" ON "public"."NotificationLog"("createdAt");
