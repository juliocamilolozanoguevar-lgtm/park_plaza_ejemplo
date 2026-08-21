FROM node:20-bookworm-slim AS build

WORKDIR /app

ARG VITE_API_URL=http://localhost:3000/api
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json

RUN npm ci --workspace client --include-workspace-root=false

COPY client ./client

WORKDIR /app/client
RUN npm run build

FROM nginx:1.27-alpine

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80
