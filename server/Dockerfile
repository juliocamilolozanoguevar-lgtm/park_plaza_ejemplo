FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY server/prisma ./server/prisma

RUN npm ci --workspace server --include-workspace-root=false --include=dev

WORKDIR /app/server
RUN npx prisma generate

COPY server ./

ENV NODE_ENV=production

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && node prisma/ensure-maintenance-user.js && npm start"]

