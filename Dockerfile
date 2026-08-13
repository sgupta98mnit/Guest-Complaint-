# Two stages: build the client with Node's toolchain, then ship only what the
# server needs to run. The runtime image carries no client dev dependencies and
# no build tools.

# ---------------------------------------------------------------- build stage
FROM node:22-slim AS build

WORKDIR /build

# VITE_BASE_PATH must be baked in at build time - Vite writes it into the asset
# URLs in index.html, so it cannot be changed by an environment variable later.
# See client/src/basePath.js.
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

# Copy manifests first so `npm ci` is cached until dependencies actually change.
COPY client/package.json client/package-lock.json ./client/
RUN npm --prefix client ci

COPY client ./client
RUN npm --prefix client run build

# -------------------------------------------------------------- runtime stage
FROM node:22-slim AS runtime

ENV NODE_ENV=production \
    PORT=3001 \
    # The database lives outside the app tree so a volume can be mounted here
    # without hiding schema.sql and seed.js, which sit in server/db/.
    ASETT_DB_PATH=/data/asett.db

WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
# --omit=dev keeps the image lean; better-sqlite3 ships a prebuilt binary for
# glibc, which is why this is node:22-slim rather than alpine (musl would force
# a source build and need python3/make/g++).
RUN npm --prefix server ci --omit=dev

COPY server ./server
# The server serves this directory when it exists - see server/index.js.
COPY --from=build /build/client/dist ./client/dist

RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 3001

# Seed first, then serve. The seed script is a no-op when rows already exist, so
# this is safe on every restart with a persistent volume.
CMD ["sh", "-c", "node server/db/seed.js && node server/index.js"]
