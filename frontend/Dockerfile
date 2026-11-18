FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

RUN addgroup -g 1001 -S nodegrp && adduser -S nodeuser -u 1001 -G nodegrp

COPY --from=builder --chown=nodeuser:nodegrp /app/public ./public
COPY --from=builder --chown=nodeuser:nodegrp /app/.next ./.next
COPY --from=builder --chown=nodeuser:nodegrp /app/package.json ./package.json
COPY --from=builder --chown=nodeuser:nodegrp /app/node_modules ./node_modules

USER nodeuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://localhost:3000/ || exit 1

# GEMINI_API_KEY and BACKEND_INTERNAL_URL are read at runtime (never baked into the image).
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
