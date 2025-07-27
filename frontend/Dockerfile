ARG BACKEND_INTERNAL_URL=placeholder_backend_url
ARG GEMINI_API_KEY=placeholder_gemini_api_key
ARG OPENAI_API_KEY=placeholder_openai_api_key
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./

RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time environment variables for Next.js
ARG BACKEND_INTERNAL_URL=http://backend:8000
ARG GEMINI_API_KEY
ARG OPENAI_API_KEY

ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV OPENAI_API_KEY=$OPENAI_API_KEY

COPY . .
COPY --from=deps /app/node_modules ./node_modules

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# Runtime environment variables
ENV BACKEND_INTERNAL_URL=http://backend:8000
ENV GEMINI_API_KEY=""
ENV OPENAI_API_KEY=""

RUN addgroup -g 1001 -S nodegrp && adduser -S nodeuser -u 1001 -G nodegrp

COPY --from=builder --chown=nodeuser:nodegrp /app/public ./public
COPY --from=builder --chown=nodeuser:nodegrp /app/.next ./.next
COPY --from=builder --chown=nodeuser:nodegrp /app/package.json ./package.json
COPY --from=builder --chown=nodeuser:nodegrp /app/node_modules ./node_modules

USER nodeuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD \
    wget -q -O /dev/null http://localhost:3000/ || exit 1

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]