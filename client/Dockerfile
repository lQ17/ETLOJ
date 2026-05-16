# ---- Build Stage ----
FROM node:18-slim AS builder

WORKDIR /app

COPY client/package*.json ./
RUN npm ci --legacy-peer-deps

COPY client/ .
RUN npm run build

# ---- Production Stage ----
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
