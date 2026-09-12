import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("health")
@Controller({ path: "health", version: "1" })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
