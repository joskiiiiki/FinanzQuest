FROM node:24-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM base AS dev
WORKDIR /app
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN touch /app/.env.local
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD sh generate_keys.sh "$API_URL_SERVER" "$API_URL_CLIENT" "$JWT_SECRET" > .env.local && yarn dev

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

RUN mkdir -p /app && \
    touch /app/.env.local && \
    chown -R nextjs:nodejs /app

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs generate_keys.sh ./

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
SHELL ["/bin/sh", "-c"]
CMD sh generate_keys.sh "$API_URL_SERVER" "$API_URL_CLIENT" "$JWT_SECRET" > .env.local && node server.js
