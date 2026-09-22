import { Queue, Worker, type Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";
import { releaseExpiredReservations } from "./jobs/release-expired-reservations.job";
import { purgeOldOtpRequests } from "./jobs/purge-old-otp-requests.job";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const QUEUE_NAME = "junuban-maintenance";
const RESERVATION_JOB_NAME = "release-expired-reservations";
const OTP_CLEANUP_JOB_NAME = "purge-old-otp-requests";

async function main() {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  const prisma = new PrismaClient();
  const queue = new Queue(QUEUE_NAME, { connection });

  // Runs every minute — reservations have a 15-minute TTL, so a 1-minute
  // sweep interval keeps released stock visible to shoppers promptly
  // without hammering the database.
  await queue.add(
    RESERVATION_JOB_NAME,
    {},
    {
      repeat: { every: 60_000 },
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );

  // Runs once a day — this is a long-tail retention cleanup (90-day
  // window, see purge-old-otp-requests.job.ts), not a time-sensitive
  // customer-facing operation like the reservation sweep above, so a
  // daily cadence is more than sufficient and avoids needless DB load.
  await queue.add(
    OTP_CLEANUP_JOB_NAME,
    {},
    {
      repeat: { every: 24 * 60 * 60 * 1000 },
      removeOnComplete: true,
      removeOnFail: 20,
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      if (job.name === RESERVATION_JOB_NAME) {
        const released = await releaseExpiredReservations(prisma);
        if (released > 0) {
          // eslint-disable-next-line no-console
          console.log(`[worker] released ${released} expired inventory reservation(s)`);
        }
        return;
      }
      if (job.name === OTP_CLEANUP_JOB_NAME) {
        const purged = await purgeOldOtpRequests(prisma);
        if (purged > 0) {
          // eslint-disable-next-line no-console
          console.log(`[worker] purged ${purged} OTP request record(s) past retention`);
        }
        return;
      }
      // Unknown job name on this queue — log rather than silently
      // ignore, since it likely means a stale/renamed job definition
      // left orphaned in Redis after a deploy.
      // eslint-disable-next-line no-console
      console.warn(`[worker] received unrecognized job "${job.name}" on ${QUEUE_NAME} — skipping`);
    },
    { connection },
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[worker] job ${job?.id} (${job?.name}) failed:`, err);
  });

  // eslint-disable-next-line no-console
  console.log(`[worker] Junubân worker started — watching ${QUEUE_NAME} queue`);

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
