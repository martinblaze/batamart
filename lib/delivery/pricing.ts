// lib/delivery/pricing.ts
// Delivery is a flat fee per order (one order = one vendor = one pickup trip),
// the same for every pickup and drop-off location. The per-zone price table
// (DeliveryZone / DeliveryRoute, editable at /admin/delivery-zones) is no
// longer consulted for pricing; the rows are left in place in case zone
// pricing comes back.

export const FLAT_DELIVERY_FEE = 1200

// Kept so the existing call sites don't change. The location arguments are
// intentionally ignored.
export async function getDeliveryFee(
  _universityId?: string | null,
  _pickupZoneName?: string | null,
  _dropoffZoneName?: string | null,
): Promise<number> {
  return FLAT_DELIVERY_FEE
}
