# syntax=docker/dockerfile:1

# Junubân worker — BullMQ background jobs (inventory reservation expiry,
# OTP cleanup, notifications), run as a normal long-running Node.js
# process. Same run-anywhere philosophy as apps/api/Dockerfile: this is
# the exact same src/index.ts entry point used in local dev (`npm run
# dev --workspace=@junuban/worker`), just compiled and run as `node
# dist/index.js` here.
#
# The worker's own package.json depends directly on @prisma/client (see
# apps/worker/src/index.ts) but ships no schema.prisma of its own — it
# is generated from apps/api/prisma/schema.prisma and, in the normal
# monorepo install, ends up in the shared workspace node_modules because
# apps/api's own `postinstall` script runs `prisma generate` whenever
# the whole workspace installs together (see apps/api/package.json).
# That path does NOT fire in a standalone build of only the worker's
# dependencies, which is exactly what building from this Dockerfile
# does — so this Dockerfile explicitly runs `prisma generate` itself,
# pointed at the API's schema, rather than assuming it already happened.
#
# Build from the MONOREPO ROOT (not apps/worker), for the same npm
# workspaces reason as the API image:
#
#   docker build -f apps/worker/Dockerfile -t junuban-worker .
#   docker run --env-file apps/worker/.env junuban-worker

FROM node:20-alpine AS base
WORKDIR /repo

# ---- deps: install full workspace dependencies -----------------------
FROM base AS deps
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
# No committed lockfile at the time of writing — see README for the
# recommendation to add one (package-lock.json / pnpm-lock.yaml) for
# reproducible installs. `npm install` still works without it.
RUN npm install --workspace=@junuban/worker --workspace=@junuban/api --include-workspace-root

# ---- build: generate the Prisma client + compile TypeScript ----------
FROM deps AS build
COPY apps/api/prisma apps/api/prisma
COPY apps/worker apps/worker
COPY tsconfig.base.json tsconfig.base.json
# Generates into the shared workspace node_modules/@prisma/client, which
# is exactly what apps/worker/src/index.ts's `import { PrismaClient }
# from "@prisma/client"` resolves to.
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace=@junuban/worker

# ---- runtime: minimal image with only what's needed to run -----------
FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN addgroup -S junuban && adduser -S junuban -G junuban

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build /repo/apps/worker/dist ./apps/worker/dist
COPY apps/worker/package.json ./apps/worker/package.json

USER junuban
WORKDIR /repo/apps/worker
# No EXPOSE — the worker holds no HTTP port open; it only connects
# outbound to Postgres and Redis (see src/index.ts).
CMD ["node", "dist/index.js"]
