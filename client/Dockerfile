# ---- Build Stage ----
FROM node:20-slim AS builder

WORKDIR /app

COPY client/package*.json ./
RUN npm ci --legacy-peer-deps

COPY client/ .
RUN npx vite build

# ---- Production Stage ----
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
