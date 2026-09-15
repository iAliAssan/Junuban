import { Queue, Worker, type Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";
import { releaseExpiredReservations } from "./jobs/release-expired-reservations.job";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const QUEUE_NAME = "inventory-maintenance";
const JOB_NAME = "release-expired-reservations";

async function main() {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  const prisma = new PrismaClient();
  const queue = new Queue(QUEUE_NAME, { connection });

  // Runs every minute — reservations have a 15-minute TTL, so a 1-minute
  // sweep interval keeps released stock visible to shoppers promptly
  // without hammering the database.
  await queue.add(
    JOB_NAME,
    {},
    {
      repeat: { every: 60_000 },
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      if (job.name !== JOB_NAME) return;
      const released = await releaseExpiredReservations(prisma);
      if (released > 0) {
        // eslint-disable-next-line no-console
        console.log(`[worker] released ${released} expired inventory reservation(s)`);
      }
    },
    { connection },
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[worker] job ${job?.id} failed:`, err);
  });

  // eslint-disable-next-line no-console
  console.log("[worker] Junubân worker started — watching inventory-maintenance queue");

  async function shutdown() {
    await worker.close();
    await queue.close();
    await prisma.$disconnect();
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[worker] fatal startup error:", err);
  process.exit(1);
});
