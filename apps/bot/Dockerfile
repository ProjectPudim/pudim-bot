# syntax=docker/dockerfile:1.7

FROM oven/bun:1.4.2 AS base
WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json bun.lock ./
COPY apps/bot/package.json ./apps/bot/
COPY packages/cache/package.json ./packages/cache/
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/framework/package.json ./packages/framework/
COPY packages/i18n/package.json ./packages/i18n/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --frozen-lockfile

FROM base AS runtime
WORKDIR /app

# Copy the application source after dependencies are cached.
COPY . .

# Drop privileges for runtime.
USER bun

WORKDIR /app/apps/bot

ENV NODE_ENV=production

CMD ["bun", "run", "start"]