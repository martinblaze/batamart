-- CreateTable
CREATE TABLE "public"."DeliveryZone" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliveryRoute" (
    "id" TEXT NOT NULL,
    "zoneAId" TEXT NOT NULL,
    "zoneBId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryZone_universityId_idx" ON "public"."DeliveryZone"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryZone_universityId_name_key" ON "public"."DeliveryZone"("universityId", "name");

-- CreateIndex
CREATE INDEX "DeliveryRoute_zoneAId_idx" ON "public"."DeliveryRoute"("zoneAId");

-- CreateIndex
CREATE INDEX "DeliveryRoute_zoneBId_idx" ON "public"."DeliveryRoute"("zoneBId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRoute_zoneAId_zoneBId_key" ON "public"."DeliveryRoute"("zoneAId", "zoneBId");

-- AddForeignKey
ALTER TABLE "public"."DeliveryZone" ADD CONSTRAINT "DeliveryZone_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "public"."University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryRoute" ADD CONSTRAINT "DeliveryRoute_zoneAId_fkey" FOREIGN KEY ("zoneAId") REFERENCES "public"."DeliveryZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryRoute" ADD CONSTRAINT "DeliveryRoute_zoneBId_fkey" FOREIGN KEY ("zoneBId") REFERENCES "public"."DeliveryZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
