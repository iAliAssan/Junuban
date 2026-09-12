# جنوبان (Junubân)

Premium, trust-first Persian RTL e-commerce platform for authentic Southern
Iranian products (dates, spices, medicinal herbs, palm-leaf crafts, gift
boxes) — single-seller, provenance-focused, direct retail.

This repository is being built **incrementally across many implementation
cycles**. See [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) for
exactly what exists today, what's next, and known issues/blockers.

## Architecture

Modular monolith monorepo (NOT microservices):

```
apps/
  web/      Next.js 14 (App Router, TypeScript, CSS Modules) — storefront + (future) admin
  api/      NestJS (TypeScript) — REST API at /api/v1
  worker/   BullMQ background worker — inventory reservation expiry, etc.
packages/
  design-tokens/   (reserved for shared token exports, currently unused —
                     tokens live in apps/web/src/styles/tokens.css)
```

- **Database:** PostgreSQL + Prisma ORM (`apps/api/prisma/schema.prisma`)
- **Cache / queues:** Redis + BullMQ
- **Object storage:** S3-compatible (MinIO locally)
- **Customer auth:** mobile number + OTP only (no passwords)
- **Admin auth:** email + Argon2id password, Owner/Staff roles

See the full locked architecture and business rules in the original
implementation prompt provided at project kickoff. Key business-model note:
a sellable **Variant** = Product × Producer × WeightOption, each with its
own price. **Inventory is tracked in grams** at the Product+Producer level
(a shared bulk lot), and consumption per order line = `weight × quantity`.

## Prerequisites

- Node.js ≥ 20
- Docker (for Postgres/Redis/MinIO) — or point `DATABASE_URL`/`REDIS_URL`/
  `S3_*` at your own instances.

## Setup

```bash
# 1. Install dependencies (workspace-wide)
npm install

# 2. Copy environment variables and fill in real secrets
cp .env.example .env

# 3. Start infrastructure
docker compose up -d

# 4. Generate the Prisma client and run migrations
npm run prisma:generate
npm run prisma:migrate

# 5. Seed development data (creates a dev admin user + sample catalog)
npm run prisma:seed

# 6. Run everything (three separate terminals, or use a process manager)
npm run dev:api      # http://localhost:4000/api/v1  (Swagger: /api/docs)
npm run dev:web      # http://localhost:3000
npm run dev:worker   # background reservation-expiry sweeper
```

Dev admin login after seeding: `owner@junuban.dev` / `ChangeMe123!`
(development only — never use in production).

## Commands

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript project-references check across all apps |
| `npm run lint` | ESLint across `apps/web` and `apps/api` |
| `npm test` | Unit/integration tests (`apps/api`, then `apps/web`) |
| `npm run build` | Production builds for all three apps |
| `npm run prisma:studio` | Visual DB browser (via `apps/api`) |

## Environment variables

See [`.env.example`](./.env.example) — every variable is documented inline.
Never commit a real `.env` file.

## Payment providers

Payment is implemented behind a `PaymentProvider` abstraction (planned —
see IMPLEMENTATION_STATUS.md for current status). No real Iranian gateway
is wired up yet; `PAYMENT_PROVIDER=stub` is a documented sandbox
implementation for local development only. Card-to-card and Sheba transfers
require manual admin confirmation by design.

## A note on this development environment

This project was scaffolded inside a sandboxed environment **without
outbound network access**, so dependencies have not been installed and
`npm run typecheck` / `build` have not actually been executed against real
`node_modules`. Package versions in each `package.json` were chosen
deliberately and are believed compatible, but you should run
`npm install && npm run typecheck` yourself as the first step after cloning
to confirm before continuing development. This is tracked as a blocker in
`IMPLEMENTATION_STATUS.md`.
