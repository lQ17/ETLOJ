# ---- Build Stage ----
FROM node:18-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY src ./src/

# ---- Production Stage ----
FROM node:18-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ python3 openjdk-17-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/src ./src

ENV JUDGE_MODE=go-judge
ENV REDIS_URL=redis://redis:6379
ENV GO_JUDGE_URL=http://go-judge:5050
ENV SERVER_URL=http://server:3000

CMD ["npx", "tsx", "src/index.ts"]
