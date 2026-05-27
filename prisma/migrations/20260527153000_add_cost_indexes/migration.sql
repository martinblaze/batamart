-- Cost-control indexes for high-traffic feed, notification, and order lookups.
CREATE INDEX IF NOT EXISTS "Product_universityId_isActive_isDeleted_quantity_idx"
  ON "public"."Product"("universityId", "isActive", "isDeleted", "quantity");

CREATE INDEX IF NOT EXISTS "Product_isHot_universityId_idx"
  ON "public"."Product"("isHot", "universityId");

CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx"
  ON "public"."Notification"("userId", "isRead", "createdAt");

CREATE INDEX IF NOT EXISTS "Order_buyerId_status_idx"
  ON "public"."Order"("buyerId", "status");
