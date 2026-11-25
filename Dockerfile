# Multi-stage production build for Cognitive Memory MCP (Node 24)
FROM node:24-slim AS builder

WORKDIR /app

# Native build toolchain for better-sqlite3 and sqlite-vec
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ gcc \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY src/ ./src/
COPY tsconfig.json tsconfig.build.json ./

RUN pnpm run build

# Production stage
FROM node:24-slim AS production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-lock.yaml ./

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ gcc curl && \
    pnpm install --prod --frozen-lockfile --ignore-scripts && \
    pnpm rebuild better-sqlite3 sqlite-vec && \
    apt-get purge -y python3 make g++ gcc && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

ENV PORT=3000
ENV MCP_HOST=0.0.0.0
ENV TRANSPORT=http
ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/index.js", "--http"]
