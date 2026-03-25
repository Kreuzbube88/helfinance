# ─── Stage 1: Build Frontend ────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Build Backend ─────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

RUN apk add --no-cache python3 make g++

COPY backend/package*.json ./
RUN npm install

COPY backend/ ./
RUN npm run build

# ─── Stage 3: Production Image ──────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/package.json ./

COPY --from=frontend-builder /app/frontend/dist ./public

RUN mkdir -p /data

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/helfinance.db \
    SECRET_KEY=changeme

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/server.js"]
