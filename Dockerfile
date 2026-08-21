# syntax=docker/dockerfile:1.7
#
# بناء العهد الجديد — production image.
#
# Debian slim rather than Alpine, deliberately. Two dependencies ship native
# binaries — `sharp`, which does the decode-and-re-encode step of the upload
# pipeline, and Prisma's query engine — and both have first-class glibc builds
# while musl is the variant that periodically needs a special case. The image is
# a few tens of megabytes larger and that is the cheapest insurance here.
#
# The Node major matches the one the project is developed on. A different major
# in production is where native modules fail in ways that never reproduce
# locally.
#
# **This image is environment-agnostic.** Every value it needs is read at
# runtime through `src/lib/env.ts`, including both `NEXT_PUBLIC_*` names, which
# are only ever read on the server. Nothing environment-specific is baked in, so
# one build promotes from staging to production unchanged. That property is
# worth protecting: the moment a *client* component reads a `NEXT_PUBLIC_*`
# value, Next inlines it into the browser bundle at build time and the image
# stops being portable.

ARG NODE_IMAGE=node:24-bookworm-slim


# ── base ──────────────────────────────────────────────────────────────────
# `-slim` ships without OpenSSL, and Prisma needs it to pick a query engine.
# Without it Prisma logs "failed to detect the libssl/openssl version to use"
# and guesses openssl-1.1.x — which happens to work on Bookworm today and is
# exactly the kind of accident that stops working during a base-image bump.
#
# `ca-certificates` is not decoration either: `docs/aws-rds-production-plan.md`
# requires the application to verify the RDS server certificate with hostname
# verification, and the same trust store backs every outbound TLS call the app
# makes — S3, Moyasar, Bunny. Encryption without verification stops
# eavesdropping but not impersonation.
FROM ${NODE_IMAGE} AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*


# ── deps ──────────────────────────────────────────────────────────────────
# Isolated so that a change to application source does not re-resolve the
# dependency tree; this layer is reused until the lockfile itself changes.
FROM base AS deps
WORKDIR /app

# `npm ci` runs Prisma's postinstall, which needs the schema present.
COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN --mount=type=cache,target=/root/.npm \
    npm ci


# ── build ─────────────────────────────────────────────────────────────────
FROM base AS build
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Explicit rather than relying on the postinstall having run in the deps stage:
# the client is generated from the schema copied above, and regenerating is
# cheap next to debugging a stale one.
RUN npx prisma generate

# No `.env` is copied (see .dockerignore) and none is needed: every route is
# dynamic, so nothing evaluates configuration at build time. Verified by
# building with the file absent.
RUN npm run build


# ── migrate ───────────────────────────────────────────────────────────────
# The controlled release job, run as a one-off task inside the VPC — never at
# application startup. `docs/aws-rds-production-plan.md` is explicit about why:
# "A process that migrates on boot will, on the day it matters, run a schema
# change from several instances at once during a rolling deploy."
#
# It carries the full dependency tree because it needs the Prisma CLI, which the
# runtime image deliberately does not have. Build it with `--target migrate`.
FROM base AS migrate
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

USER node
CMD ["npx", "prisma", "migrate", "deploy"]


# ── runtime ───────────────────────────────────────────────────────────────
FROM base AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # The standalone server binds this; without it Node listens on localhost
    # only and every health check from outside the container fails.
    HOSTNAME=0.0.0.0

# `output: 'standalone'` emits the server plus only the modules actually
# reached, so there is no `npm install` here and no build toolchain in the final
# image. The three copies below are the whole runtime: traced server, static
# assets, and the public directory.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# Belt and braces. Next's tracer normally follows the generated Prisma client
# into the standalone output, but the query engine is a platform binary reached
# through a runtime path rather than a static import, which is exactly the shape
# a static tracer can miss. Copying it explicitly costs a layer and removes a
# failure that would only appear on the first database call in production.
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma

# Never root. The image has an unprivileged `node` user already.
USER node

EXPOSE 3000

# App Runner and ALB run their own probes, so this mainly serves local and
# Compose use — but a container that cannot report its own liveness is harder to
# debug everywhere. Shallow by design; see src/app/api/health/route.ts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
