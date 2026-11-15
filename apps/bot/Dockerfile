# Stage 1 - dependências de produção, só deste app (e dos packages que ele usa)
FROM docker.io/oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --filter './apps/bot'

# Stage 2 - runtime
FROM docker.io/oven/bun:1-alpine AS runtime
ENV NODE_ENV=production

# Reaps zombies and forwards signals for clean shutdown
RUN apk add --no-cache tini

# Not /home/discloud: Discloud mounts a volume there that hides the image contents
WORKDIR /discloud/home

COPY --from=deps --chown=bun:bun /app ./

USER bun

WORKDIR /discloud/home/apps/bot

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "--env-file-if-exists=.env", "run", "./src/index.ts"]
