# syntax=docker/dockerfile:1

# Junubân API — NestJS, run as a normal Node.js process.
#
# This does not change the application: it runs the exact same
# src/main.ts entry point used locally and on Vercel. On Vercel,
# process.env.VERCEL === "1" is set automatically and main.ts skips
# app.listen() in favor of exporting a request handler; here (and on
# any plain Linux/VPS host) VERCEL is unset, so main.ts calls
# app.listen(process.env.PORT ?? 4000) as a normal long-running server.
#
# Build from the MONOREPO ROOT (not apps/api), because this is an npm
# workspace and needs the root package.json/workspaces to install and
# link correctly:
#
#   docker build -f apps/api/Dockerfile -t junuban-api .
#   docker run --env-file apps/api/.env -p 4000:4000 junuban-api

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
RUN npm install --workspace=@junuban/api --include-workspace-root

# ---- build: compile TypeScript + generate Prisma client --------------
FROM deps AS build
COPY apps/api apps/api
COPY tsconfig.base.json tsconfig.base.json
RUN npm run prisma:generate --workspace=@junuban/api \
  && npm run build --workspace=@junuban/api

# ---- runtime: minimal image with only what's needed to run -----------
FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN addgroup -S junuban && adduser -S junuban -G junuban

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY apps/api/package.json ./apps/api/package.json

USER junuban
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
