import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === "development"
          ? [{ emit: "event", level: "query" }, "warn", "error"]
          : ["warn", "error"],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Connected to PostgreSQL via Prisma");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Runs `fn` inside a serializable transaction, retrying a small number
   * of times on Postgres serialization failures. Used for inventory
   * reservation/consumption and other concurrency-sensitive writes (see
   * OrdersService.checkout/markOrderPaid/cancelOrder) — read-then-write
   * on the same Inventory row is safe under Serializable isolation
   * because Postgres detects the conflicting concurrent read/write
   * pattern and aborts one transaction with a serialization failure
   * (Prisma surfaces this as error code P2034), which this method
   * retries from scratch rather than requiring hand-written
   * compare-and-swap SQL for every call site.
   *
   * `Prisma.TransactionClient` is Prisma's own exported type for exactly
   * this callback shape — using it directly (rather than extracting the
   * parameter type from `$transaction`'s overloaded signature) avoids
   * the `as any` cast this helper previously needed.
   */
  async runSerializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, maxRetries = 3): Promise<T> {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await this.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (err) {
        attempt += 1;
        const isSerializationFailure =
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code?: string }).code === "P2034";
        if (!isSerializationFailure || attempt >= maxRetries) {
          throw err;
        }
      }
    }
  }
}
