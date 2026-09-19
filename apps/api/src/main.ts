import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType, type INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * APP_URL is normally one origin, but production sometimes needs more
 * than one allowed frontend (e.g. the vercel.app domain plus a custom
 * domain during migration, or a preview deployment). Comma-separate
 * them in the same APP_URL variable; a single URL still works exactly
 * as before.
 */
function allowedOrigins(): string[] {
  return (process.env.APP_URL ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function createApp(): Promise<NestExpressApplication> {
  // NestExpressApplication specifically (not the generic
  // INestApplication NestFactory.create<T> defaults to) — the generic
  // interface has no `.set()` method, which `app.set("trust proxy", 1)`
  // below needs. This app has always run on the Express adapter (see
  // @nestjs/platform-express in package.json); this only fixes the
  // compile-time type to match what was already true at runtime, it
  // changes no behavior.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn", "log"],
  });

  // Both a Vercel serverless deployment and a typical VPS reverse-proxy
  // setup (nginx/Caddy in front of Node — see the Docker/VPS portability
  // notes referenced from this project's own deployment docs) put a
  // proxy in front of this app, so Express's own socket-level `req.ip`
  // would otherwise report the proxy's IP for every single request
  // rather than the real client's. That silently breaks anything keyed
  // on IP — the OTP per-IP rate limit (OtpService.ipRateLimitKey) would
  // put every request into one shared bucket, and the IP address
  // audited on OtpRequest rows would be wrong.
  //
  // `trust proxy: 1` tells Express to read the client IP from exactly
  // one hop into `X-Forwarded-For` (i.e. trust exactly one proxy in
  // front of this process). This value MUST match the real number of
  // proxies between the internet and this app — set it too high (or to
  // `true`, meaning "trust all hops") on a deployment with only one real
  // proxy, and a client can forge its own `X-Forwarded-For` prefix to
  // spoof whichever IP this app ends up trusting, defeating both the
  // rate limit and the audit trail. `1` is correct for both Vercel
  // (its edge network is the sole hop) and a standard single-nginx-
  // reverse-proxy VPS setup; adjust it if a different topology (e.g. an
  // extra load balancer) is introduced.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: allowedOrigins(),
    credentials: true,
  });

  app.setGlobalPrefix("api");

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger exposes the entire API surface (every route, DTO shape, and
  // both cookie-auth schemes) to anyone who requests the page — fine for
  // local/staging work, but not something that should be silently public
  // in production by default. Gated on NODE_ENV rather than removed
  // outright, with an explicit opt-in escape hatch (ENABLE_SWAGGER=true)
  // for teams that intentionally want it reachable in a given production
  // deployment (e.g. an internal-only staging environment that also sets
  // NODE_ENV=production).
  const swaggerEnabled = process.env.NODE_ENV !== "production" || process.env.ENABLE_SWAGGER === "true";
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Junubân API")
      .setDescription("Persian RTL e-commerce platform — backend API")
      .setVersion("1.0")
      .addCookieAuth("junuban_session")
      .addCookieAuth("junuban_admin_session")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document);
  }

  await app.init();

  return app;
}

/**
 * Vercel serverless handler.
 *
 * Typed against the raw Node `IncomingMessage`/`ServerResponse`, not
 * Express's `Request`/`Response` — this is what both sides of the call
 * actually structurally guarantee: Vercel's Node runtime hands the
 * handler its own request/response objects (not Express's, since
 * Express hasn't run yet at this point), and `getHttpAdapter().getInstance()`
 * returns the underlying Express app *as a callable listener*, i.e. the
 * same `(req, res)` shape any plain `http.createServer` handler expects.
 * Express then does its own upgrade/parsing of these into `Request`/
 * `Response` internally. Declaring the parameters as `Request`/`Response`
 * here would claim a stronger guarantee (cookies, `req.ip`, parsed body,
 * etc. already present) than actually holds at the point Vercel invokes
 * this function.
 *
 * `appPromise` is read and (on a cold start) assigned within a single
 * expression via `??=`, rather than the previous "if (!cachedHandler) {
 * assign }" shape. TypeScript's control-flow narrowing does not carry a
 * `let` that's captured by a closure across an `await`/branch merge —
 * hence the "possibly undefined" error on `cachedHandler(req, res)` —
 * but it does understand the type of a `??=` expression directly, so
 * this is provably `Promise<INestApplication>` (the declared type of
 * `appPromise` below — `NestExpressApplication` widens to it without
 * issue) without `as any` or a relaxed tsconfig.
 *
 * Caching the *Promise* rather than the resolved app also closes a
 * latent race the old code had: `appPromise ??= createApp()` assigns
 * synchronously, before any `await` runs, so if two requests hit a
 * cold instance back to back, the second one reuses the first's
 * in-flight promise instead of bootstrapping Nest a second time.
 */
let appPromise: Promise<INestApplication> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await (appPromise ??= createApp());
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
}

/**
 * Local development / traditional Node server.
 */
if (process.env.VERCEL !== "1") {
  void (async () => {
    const app = await createApp();

    const port = Number(process.env.PORT ?? 4000);
    await app.listen(port);

    console.log(
      `Junubân API listening on http://localhost:${port}/api/v1`,
    );
    console.log(
      `Swagger docs at http://localhost:${port}/api/docs`,
    );
  })();
}
