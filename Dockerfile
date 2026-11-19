# Multi-stage production build for Cognitive Memory MCP
FROM node:20-slim AS builder

WORKDIR /app

# Install native dependencies required for better-sqlite3 and sqlite-vec compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ gcc libopenblas-dev \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY src/ ./src/
COPY tsconfig.json tsconfig.build.json ./

RUN pnpm run build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ gcc libopenblas0 curl && \
    pnpm install --prod --ignore-scripts && \
    pnpm rebuild better-sqlite3 sqlite-vec && \
    apt-get purge -y python3 make g++ gcc && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

ENV PORT=3000
ENV TRANSPORT=sse
ENV NODE_ENV=production

EXPOSE 3000

# Runs SSE transport for containerized access by default, or accepts "stdio" / CLI args
CMD ["node", "dist/index.js", "--sse"]
