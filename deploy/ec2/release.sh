#!/usr/bin/env bash
#
# Build and release بناء العهد الجديد on a single EC2 instance, under systemd.
#
# The order below is the one docs/deployment.md fixes and it is not arbitrary:
# migrate first, as its own step, confirmed before anything serves. Nothing
# migrates at process start — several PM2 restarts racing a schema change is the
# failure that document names.
#
#   sudo /opt/new-era/deploy/ec2/release.sh
#
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/new-era}
ENV_FILE=${ENV_FILE:-/etc/new-era/app.env}
STANDALONE="$APP_DIR/.next/standalone"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

[ -r "$ENV_FILE" ] || { echo "release: $ENV_FILE is missing or unreadable" >&2; exit 1; }

cd "$APP_DIR"

# ── Swap check ────────────────────────────────────────────────────────────
# `next build` on 2 GB without swap is killed by the OOM killer partway
# through, and the message it leaves ("Killed") names neither the cause nor the
# fix. Refuse up front instead.
total_ram=$(free -m | awk '/^Mem:/{print $2}')
total_swap=$(free -m | awk '/^Swap:/{print $2}')
if [ "$total_ram" -lt 4000 ] && [ "$total_swap" -lt 2000 ]; then
  echo "release: ${total_ram}MB RAM and ${total_swap}MB swap is not enough to build." >&2
  echo "         Add swap first:" >&2
  echo "           sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress" >&2
  echo "           sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile" >&2
  echo "           echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab" >&2
  exit 1
fi

log "Installing dependencies"
# `npm ci` and not `install`: the lockfile is the input, and a release that
# quietly resolves a different tree than the one tested is not the same release.
npm ci --no-audit --no-fund

log "Generating the Prisma client"
npx prisma generate

log "Applying migrations"
# Read the DDL credential explicitly rather than inheriting the app's. It is a
# separate role on purpose — see infra/sql/02-create-roles.sql — so the running
# application cannot alter the schema even if it is compromised.
if grep -q '^MIGRATE_DATABASE_URL=' "$ENV_FILE"; then
  DATABASE_URL="$(grep '^MIGRATE_DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)" \
    npx prisma migrate deploy
else
  echo "release: MIGRATE_DATABASE_URL not set; falling back to DATABASE_URL." >&2
  echo "         The runtime role should not own the schema — see infra/sql/02-create-roles.sql." >&2
  node --env-file="$ENV_FILE" -e 'process.exit(process.env.DATABASE_URL?0:1)' \
    || { echo "release: no DATABASE_URL either" >&2; exit 1; }
  set -a; . "$ENV_FILE"; set +a
  npx prisma migrate deploy
fi

log "Building"
NODE_ENV=production npm run build

# ── The standalone copy ───────────────────────────────────────────────────
# `server.js` resolves assets relative to its own directory, and `next build`
# does not put them there. Without these two copies every page serves its HTML
# and 404s on all CSS and JS — which reads as a broken application rather than
# as a missing file copy. The Dockerfile does exactly this, for the same reason.
log "Staging static assets beside the standalone server"
mkdir -p "$STANDALONE/.next"
rm -rf "$STANDALONE/.next/static" "$STANDALONE/public"
cp -r "$APP_DIR/.next/static" "$STANDALONE/.next/static"
cp -r "$APP_DIR/public" "$STANDALONE/public"

# Deliberately NO chown of the tree to `newera`.
#
# The service only ever reads these files — ProtectSystem=strict mounts the
# filesystem read-only for it, and with STORAGE_PROVIDER=s3 the application
# writes nothing locally. Ordinary read permission is therefore enough, and
# handing ownership to the service account instead locks the operator out of
# `git pull` in the very same directory.
#
# What matters is that `newera` can traverse and read, which is checked rather
# than assumed: a build run under a restrictive umask would otherwise fail at
# runtime as a 404 on every asset.
# The one directory the service writes to: Next's image-optimiser cache. The
# unit names it in ReadWritePaths; it still has to exist and be owned by the
# service account. Without it every /_next/image request re-encodes with sharp
# and logs an unhandled rejection.
log "Creating the image cache directory"
install -d -o newera -g newera -m 755 "$STANDALONE/.next/cache"

log "Checking the service account can read the build"
chmod -R a+rX "$APP_DIR/.next/standalone" "$APP_DIR/public"
if ! runuser -u newera -- test -r "$STANDALONE/server.js"; then
  echo "release: the newera user cannot read $STANDALONE/server.js" >&2
  exit 1
fi

log "Restarting the service"
systemctl restart new-era

log "Waiting for health"
port=$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2- || true)
port=${port:-3000}
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
    echo "release: healthy after ${i}s"
    exit 0
  fi
  sleep 1
done

echo "release: never became healthy on port ${port}" >&2
systemctl --no-pager status new-era >&2 || true
journalctl -u new-era --no-pager --lines 40 >&2 || true
exit 1
