import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("health")
@Controller({ path: "health", version: "1" })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Exempt from the global rate limit (see AppModule's APP_GUARD
  // comment) — this endpoint exists specifically to be polled
  // frequently by infrastructure (Docker healthchecks, uptime monitors,
  // Vercel), often from a shared IP behind a load balancer alongside
  // real user traffic, so it must never compete for the same request
  // budget as that traffic.
  @SkipThrottle()
  @Get()
  async check(): Promise<{ status: "ok" | "degraded"; database: boolean; time: string }> {
    let database = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = false;
    }
    return {
      status: database ? "ok" : "degraded",
      database,
      time: new Date().toISOString(),
    };
  }
}
