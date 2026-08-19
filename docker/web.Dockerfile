FROM node:20-bookworm-slim AS build

WORKDIR /app
COPY client/package*.json ./
RUN npm ci
COPY client/tsconfig*.json client/vite.config.ts client/index.html ./
COPY client/public ./public
COPY client/src ./src
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
