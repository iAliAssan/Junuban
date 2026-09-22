import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { join } from "node:path";
import configuration from "./config/configuration";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { CartModule } from "./cart/cart.module";
import { OrdersModule } from "./orders/orders.module";
import { AddressesModule } from "./addresses/addresses.module";
import { AdminModule } from "./admin/admin.module";

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
    /**
     * KNOWN LIMITATION: no custom `storage` is configured above, so
     * @nestjs/throttler falls back to its default in-memory counter.
     * That counter is per-process — correct for a single long-running
     * Node process (the Docker/VPS deployment this app also targets,
     * see docker-compose.prod.yml), but NOT correct across multiple
     * concurrent instances (several Vercel serverless invocations, or
     * several Docker replicas behind a load balancer), where each
     * instance keeps its own independent count and the effective limit
     * becomes (configured limit × instance count) rather than the
     * configured limit. Redis (already a hard dependency of this app —
     * see RedisModule/RedisService, used by OtpService and cart
     * sessions) is the right shared backing store for this; a custom
     * `ThrottlerStorage` implementation against `RedisService.client`
     * was intentionally NOT added here without being able to verify its
     * exact interface against the installed `@nestjs/throttler` version
     * in an environment with real `node_modules` — an unverified custom
     * implementation of a third-party interface risks a silent runtime
     * break that is worse than this documented, understood limitation.
     * Before scaling this API horizontally, either add a verified Redis
     * `ThrottlerStorage` implementation or an equivalent officially
     * supported package.
     */
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    AddressesModule,
    AdminModule,
  ],
  providers: [
    // ThrottlerModule.forRoot() only registers configuration — it does
    // NOT rate-limit anything on its own. Without also binding
    // ThrottlerGuard as a global APP_GUARD, every route in this API
    // (aside from the few with their own separate, purpose-specific
    // limiter, such as OtpService's Redis-based per-phone/per-IP limits
    // and AdminAuthService's login attempt limiter) had NO general rate
    // limiting at all, despite RATE_LIMIT_WINDOW_SECONDS/
    // RATE_LIMIT_MAX_REQUESTS being fully configured and documented in
    // .env.example. This depends on main.ts's `app.set("trust proxy", 1)`
    // to key correctly by real client IP behind a reverse proxy — see
    // that file's own comment on why the trust depth matters.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
