# Rother - Full Web Dashboard Dockerfile
# Multi-stage build for lean production image
# Build: docker build -t rother:latest .
# Run: docker run --rm -p 3000:3000 -v rother-data:/app/gbp-monitor/data rother:latest

FROM node:22-alpine AS dashboard-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src/ src/
COPY tsconfig.json ./
COPY next.config.* ./
COPY tailwind.config.* ./
COPY postcss.config.* ./
COPY .zscripts/ .zscripts/

RUN npm run build

FROM python:3.11-slim AS py-builder

WORKDIR /build
COPY gbp-monitor/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0t64 libatk-bridge2.0-0t64 \
    libcups2t64 libdrm2 libdbus-1-3 libexpat1 libxcb1 \
    libxkbcommon0 libx11-6 libxcomposite1 libxdamage1 \
    libxext6 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libegl1 \
    nodejs npm \
    && rm -rf /var/lib/apt/lists/*

COPY --from=py-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=py-builder /usr/local/bin /usr/local/bin

RUN playwright install chromium 2>/dev/null || true

COPY --from=dashboard-builder /app/.next/standalone .next/standalone/
COPY --from=dashboard-builder /app/package.json ./
COPY --from=dashboard-builder /app/public/ public/ 2>/dev/null || mkdir -p public

COPY src/ src/
COPY tsconfig.json ./
COPY next.config.* ./
COPY tailwind.config.* ./
COPY postcss.config.* ./
COPY .zscripts/ .zscripts/

COPY gbp-monitor/ gbp-monitor/

RUN useradd -m -u 1001 rother && \
    mkdir -p /app/gbp-monitor/data && \
    chown -R rother:rother /app

USER rother

WORKDIR /app

# Environment variables for Docker/Cloud deployment
# GBP_MONITOR_NO_SANDBOX: Required for non-root Chromium in containers
# GBP_MONITOR_TIGHT_MEMORY: Enables memory-saving Chromium flags for low-RAM VMs
ENV GBP_MONITOR_NO_SANDBOX=true
ENV GBP_MONITOR_TIGHT_MEMORY=true

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

ENTRYPOINT ["node", ".next/standalone/server.js"]