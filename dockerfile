FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
COPY public ./public
RUN rm -rf dist && npm run build && test -f dist/src/main.js

FROM node:22-alpine AS production
WORKDIR /app

RUN apk add --no-cache mariadb-client

RUN npm install -g pm2 --no-audit --no-fund

COPY package*.json ecosystem.config.cjs ./
RUN npm install --production --no-audit --no-fund

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
