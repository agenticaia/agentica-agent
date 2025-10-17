# Image size ~ 400MB
FROM node:21-alpine3.18 AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package*.json *-lock.yaml ./
RUN pnpm install

COPY . .

RUN pnpm run build


# Etapa 2: Deploy
FROM node:21-alpine3.18 AS deploy

WORKDIR /app

ARG PORT=3008
ENV PORT=$PORT
EXPOSE $PORT

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/assets ./assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json /app/*-lock.yaml ./

RUN pnpm install --prod --ignore-scripts

CMD ["pnpm", "start"]# Image size ~ 400MB
FROM node:21-alpine3.18 AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package*.json *-lock.yaml ./
RUN pnpm install

COPY . .

RUN pnpm run build


# Etapa 2: Deploy
FROM node:21-alpine3.18 AS deploy

WORKDIR /app

ARG PORT=3008
ENV PORT=$PORT
EXPOSE $PORT

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/assets ./assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json /app/*-lock.yaml ./

RUN pnpm install --prod --ignore-scripts

CMD ["pnpm", "start"]