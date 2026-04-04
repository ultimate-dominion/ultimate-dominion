FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

WORKDIR /app

COPY package.json ./
RUN pnpm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN echo "build-v0.2.4-$(date +%s)" > /tmp/build-marker && pnpm build

FROM node:20-slim

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

WORKDIR /app

COPY package.json ./
RUN pnpm install --prod

COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/index.js"]
