import { PrismaClient } from "@prisma/client";

/**
 * Finds ACTIVE reservations past their `expiresAt` (15-minute checkout
 * hold, see INVENTORY_RESERVATION_TTL_MINUTES) and releases them:
 * decrements the owning Inventory row's `reservedGrams` and marks the
 * reservation EXPIRED. Runs inside a transaction per reservation so a
 * crash mid-batch never leaves grams "reserved forever" nor double-frees
 * the same reservation (guarded by the `status: "ACTIVE"` predicate in
 * the same update).
 */
export async function releaseExpiredReservations(prisma: PrismaClient): Promise<number> {
  const now = new Date();
  const expired = await prisma.inventoryReservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: now } },
    select: { id: true, grams: true, variant: { select: { productProducerId: true } } },
    take: 200, // bounded batch size per run
  });

  let releasedCount = 0;

  for (const reservation of expired) {
    await prisma.$transaction(async (tx) => {
      // Guard against a race where another process already released this
      // exact reservation between the findMany above and this write.
      const updated = await tx.inventoryReservation.updateMany({
        where: { id: reservation.id, status: "ACTIVE" },
        data: { status: "EXPIRED", releasedAt: now },
      });
      if (updated.count === 0) return;

      await tx.inventory.update({
        where: { productProducerId: reservation.variant.productProducerId },
        data: { reservedGrams: { decrement: reservation.grams } },
      });
    });
    releasedCount += 1;
  }

  return releasedCount;
}
