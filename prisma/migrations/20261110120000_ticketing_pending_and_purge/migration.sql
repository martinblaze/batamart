-- Pending flyer/description changes on live events, and keeping money/audit history after tickets are purged.
-- Additive only: no data is dropped.

-- TicketEvent: host edits to a live event wait here for admin approval.
ALTER TABLE "public"."TicketEvent" ADD COLUMN "pendingFlyerUrl" TEXT,
ADD COLUMN "pendingDescription" TEXT,
ADD COLUMN "pendingChangeAt" TIMESTAMP(3);

-- TicketScan: snapshot of the ticket code (the Ticket row is deleted after the event).
ALTER TABLE "public"."TicketScan" ADD COLUMN "ticketCode" TEXT;
UPDATE "public"."TicketScan" s SET "ticketCode" = t."code" FROM "public"."Ticket" t WHERE s."ticketId" = t."id";

-- TicketTransfer: survive the ticket's deletion. Backfill snapshots from Ticket, then make them required.
ALTER TABLE "public"."TicketTransfer" ADD COLUMN "eventId" TEXT,
ADD COLUMN "ticketCode" TEXT;
UPDATE "public"."TicketTransfer" x SET "eventId" = t."eventId", "ticketCode" = t."code" FROM "public"."Ticket" t WHERE x."ticketId" = t."id";
ALTER TABLE "public"."TicketTransfer" ALTER COLUMN "eventId" SET NOT NULL,
ALTER COLUMN "ticketCode" SET NOT NULL;
ALTER TABLE "public"."TicketTransfer" ALTER COLUMN "ticketId" DROP NOT NULL;

ALTER TABLE "public"."TicketTransfer" DROP CONSTRAINT "TicketTransfer_ticketId_fkey";
ALTER TABLE "public"."TicketTransfer" ADD CONSTRAINT "TicketTransfer_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TicketTransfer_eventId_idx" ON "public"."TicketTransfer"("eventId");
