FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

WORKDIR /app

COPY package.json ./
RUN pnpm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm build

FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

WORKDIR /app

COPY package.json ./
RUN pnpm install --prod

COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/index.js"]
