# ---------- Stage 1: deps ----------
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

# Copy lockfiles (copy only what you actually use)
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# Use ONE package manager. Here: npm
RUN npm ci

# ---------- Stage 2: build ----------
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Optional: if using standalone output, ensure next.config.js has:  output: 'standalone'
RUN npm run build

# ---------- Stage 3: runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# Create non-root user
RUN addgroup -g 1001 -S nodegrp && adduser -S nodeuser -u 1001 -G nodegrp
USER nodeuser

# If using standalone, copy only necessary output
# Otherwise copy .next + public + node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD \
    wget -q -O /dev/null http://localhost:3000/ || exit 1

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]