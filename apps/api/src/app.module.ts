import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { join } from "node:path";
import configuration from "./config/configuration";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { CartModule } from "./cart/cart.module";
import { OrdersModule } from "./orders/orders.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // The monorepo keeps one shared .env at the repository root.
      envFilePath: [join(__dirname, "../../../.env"), join(__dirname, "../.env")],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60) * 1000,
        limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
      },
    ]),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    CatalogModule,
    CartModule,
    OrdersModule,
  ],
})
export class AppModule {}
