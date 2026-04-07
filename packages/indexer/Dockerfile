FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

WORKDIR /app

COPY package.json ./
COPY patches/ ./patches/
RUN pnpm install

# cache-bust: v3
COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm build

FROM node:20-slim

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

WORKDIR /app

COPY package.json ./
COPY patches/ ./patches/
RUN pnpm install --prod

COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["node", "dist/index.js"]
