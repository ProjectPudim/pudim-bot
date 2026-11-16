FROM mongo:8.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl unzip \
  && curl -fsSL https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-linux-x64.zip -o /tmp/bun.zip \
  && unzip -q /tmp/bun.zip -d /tmp \
  && mv /tmp/bun-linux-x64/bun /usr/local/bin/bun \
  && chmod 755 /usr/local/bin/bun \
  && rm -rf /tmp/* /var/lib/apt/lists/*

WORKDIR /app

COPY --chown=mongodb:mongodb package.json ./
COPY --chown=mongodb:mongodb src ./src

RUN mkdir -p /data/backups && chown -R mongodb:mongodb /data/backups

USER mongodb

ENV NODE_ENV=production

ENTRYPOINT []
CMD ["bun", "run", "start"]