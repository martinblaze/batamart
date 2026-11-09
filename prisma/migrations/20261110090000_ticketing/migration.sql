-- CreateEnum
CREATE TYPE "public"."TicketEventStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."TicketStatus" AS ENUM ('VALID', 'CHECKED_IN', 'VOID');

-- CreateEnum
CREATE TYPE "public"."TicketPurchaseStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."TicketSellerKind" AS ENUM ('DIRECT', 'RANDOM', 'UNIQUE');

-- CreateTable
CREATE TABLE "public"."TicketEvent" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "venue" TEXT NOT NULL,
    "address" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "flyerUrl" TEXT,
    "status" "public"."TicketEventStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "allowResale" BOOLEAN NOT NULL DEFAULT true,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TicketTier" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "randomCommissionPct" INTEGER NOT NULL DEFAULT 0,
    "uniqueCommissionPct" INTEGER NOT NULL DEFAULT 0,
    "saleStartsAt" TIMESTAMP(3),
    "saleEndsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EventChecker" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "tokenHash" TEXT NOT NULL,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventChecker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EventSeller" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSeller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TicketListing" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TicketPurchase" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "buyerUserId" TEXT,
    "buyerEmail" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "commission" INTEGER NOT NULL DEFAULT 0,
    "hostAmount" INTEGER NOT NULL,
    "resellerId" TEXT,
    "sellerKind" "public"."TicketSellerKind" NOT NULL DEFAULT 'DIRECT',
    "status" "public"."TicketPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT NOT NULL DEFAULT 'CARD',
    "gatewayTxId" TEXT,
    "accessToken" TEXT NOT NULL,
    "overbooked" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ticket" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "secretVersion" INTEGER NOT NULL DEFAULT 1,
    "ownerUserId" TEXT,
    "ownerEmail" TEXT NOT NULL,
    "status" "public"."TicketStatus" NOT NULL DEFAULT 'VALID',
    "checkedInAt" TIMESTAMP(3),
    "checkedInById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TicketTransfer" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TicketScan" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "checkerId" TEXT NOT NULL,
    "ticketId" TEXT,
    "result" TEXT NOT NULL,
    "holderName" TEXT,
    "tierName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketEvent_status_startsAt_idx" ON "public"."TicketEvent"("status", "startsAt");

-- CreateIndex
CREATE INDEX "TicketEvent_hostId_idx" ON "public"."TicketEvent"("hostId");

-- CreateIndex
CREATE INDEX "TicketTier_eventId_idx" ON "public"."TicketTier"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTier_eventId_name_key" ON "public"."TicketTier"("eventId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "EventChecker_tokenHash_key" ON "public"."EventChecker"("tokenHash");

-- CreateIndex
CREATE INDEX "EventChecker_eventId_idx" ON "public"."EventChecker"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventChecker_eventId_email_key" ON "public"."EventChecker"("eventId", "email");

-- CreateIndex
CREATE INDEX "EventSeller_userId_idx" ON "public"."EventSeller"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventSeller_eventId_userId_key" ON "public"."EventSeller"("eventId", "userId");

-- CreateIndex
CREATE INDEX "TicketListing_sellerId_idx" ON "public"."TicketListing"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketListing_eventId_sellerId_key" ON "public"."TicketListing"("eventId", "sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketPurchase_reference_key" ON "public"."TicketPurchase"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "TicketPurchase_accessToken_key" ON "public"."TicketPurchase"("accessToken");

-- CreateIndex
CREATE INDEX "TicketPurchase_eventId_status_idx" ON "public"."TicketPurchase"("eventId", "status");

-- CreateIndex
CREATE INDEX "TicketPurchase_buyerUserId_idx" ON "public"."TicketPurchase"("buyerUserId");

-- CreateIndex
CREATE INDEX "TicketPurchase_buyerEmail_idx" ON "public"."TicketPurchase"("buyerEmail");

-- CreateIndex
CREATE INDEX "TicketPurchase_resellerId_idx" ON "public"."TicketPurchase"("resellerId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "public"."Ticket"("code");

-- CreateIndex
CREATE INDEX "Ticket_ownerUserId_idx" ON "public"."Ticket"("ownerUserId");

-- CreateIndex
CREATE INDEX "Ticket_ownerEmail_idx" ON "public"."Ticket"("ownerEmail");

-- CreateIndex
CREATE INDEX "Ticket_eventId_status_idx" ON "public"."Ticket"("eventId", "status");

-- CreateIndex
CREATE INDEX "Ticket_purchaseId_idx" ON "public"."Ticket"("purchaseId");

-- CreateIndex
CREATE INDEX "TicketTransfer_ticketId_idx" ON "public"."TicketTransfer"("ticketId");

-- CreateIndex
CREATE INDEX "TicketTransfer_fromUserId_idx" ON "public"."TicketTransfer"("fromUserId");

-- CreateIndex
CREATE INDEX "TicketTransfer_toUserId_idx" ON "public"."TicketTransfer"("toUserId");

-- CreateIndex
CREATE INDEX "TicketScan_eventId_createdAt_idx" ON "public"."TicketScan"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketScan_checkerId_idx" ON "public"."TicketScan"("checkerId");

-- AddForeignKey
ALTER TABLE "public"."TicketEvent" ADD CONSTRAINT "TicketEvent_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketTier" ADD CONSTRAINT "TicketTier_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."TicketEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventChecker" ADD CONSTRAINT "EventChecker_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."TicketEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventSeller" ADD CONSTRAINT "EventSeller_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."TicketEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventSeller" ADD CONSTRAINT "EventSeller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketListing" ADD CONSTRAINT "TicketListing_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."TicketEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketListing" ADD CONSTRAINT "TicketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketPurchase" ADD CONSTRAINT "TicketPurchase_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."TicketEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketPurchase" ADD CONSTRAINT "TicketPurchase_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "public"."TicketTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketPurchase" ADD CONSTRAINT "TicketPurchase_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketPurchase" ADD CONSTRAINT "TicketPurchase_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "public"."TicketPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."TicketEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "public"."TicketTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "public"."EventChecker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketTransfer" ADD CONSTRAINT "TicketTransfer_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketScan" ADD CONSTRAINT "TicketScan_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."TicketEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketScan" ADD CONSTRAINT "TicketScan_checkerId_fkey" FOREIGN KEY ("checkerId") REFERENCES "public"."EventChecker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketScan" ADD CONSTRAINT "TicketScan_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

