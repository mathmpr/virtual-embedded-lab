FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173 \
    CLANGXX=clang++

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends clang lld ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY apps ./apps
COPY components ./components
COPY examples ./examples

RUN mkdir -p /app/shared \
  && chown -R node:node /app/shared

USER node

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4173) + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/web/server.mjs"]
