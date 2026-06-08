# --- build stage ------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++

# Install all deps including dev so we can compile TypeScript.
COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY scripts ./scripts
COPY assistants ./assistants

RUN npm run build

# --- runtime stage ----------------------------------------------------------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Add a non-root user to avoid running as root.
RUN addgroup -S disco && adduser -S disco -G disco

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/src/db/migrations ./dist/src/db/migrations
COPY assistants ./assistants

USER disco

CMD ["node", "dist/src/index.js"]
