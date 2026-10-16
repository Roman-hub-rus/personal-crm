# syntax=docker/dockerfile:1

# Production image: the Next.js standalone server plus bundled migrate and seed scripts.
# Built by .github/workflows/deploy.yml and run on the server by deploy/compose.yml.

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies first: this layer is reused while package.json and the lockfile stay the same.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g "$(node -p 'require("./package.json").packageManager')" \
 && pnpm install --frozen-lockfile

COPY . .
# The app reads DATABASE_URL on import, but the build never connects, so a placeholder is enough.
RUN DATABASE_URL=postgres://build@localhost/build pnpm build \
 && pnpm exec esbuild src/db/migrate.ts src/db/seed.ts --bundle --platform=node --format=esm \
      --target=node24 --outdir=db-scripts --out-extension:.js=.mjs

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/db-scripts ./db
COPY --from=builder /app/drizzle ./drizzle
# App files stay owned by root; the app may write only to the Next.js cache.
RUN mkdir -p .next/cache && chown node:node .next/cache

# Last, so a new commit only rebuilds this tiny layer.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

USER node
EXPOSE 3000
CMD ["node", "server.js"]
