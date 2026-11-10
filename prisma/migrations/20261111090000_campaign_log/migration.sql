-- Notification frequency choice: NORMAL (up to 6 a day), FEWER (2 a day), ORDERS_ONLY.
-- Additive only. Campaign bookkeeping reuses NotificationLog, so no new table.
ALTER TABLE "public"."NotificationPreference" ADD COLUMN "notifyFrequency" TEXT NOT NULL DEFAULT 'NORMAL';
