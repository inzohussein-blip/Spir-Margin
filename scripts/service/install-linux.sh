#!/usr/bin/env bash
# Install Spir-Margin as a systemd service so it starts with the computer.
#
#   sudo ./scripts/service/install-linux.sh              # port 3000, this computer only
#   sudo PORT=8080 ./scripts/service/install-linux.sh    # a different port
#   sudo HOST=0.0.0.0 ./scripts/service/install-linux.sh # also the office network (see docs/INSTALL.md)
#   sudo SPIR_SEED=demo ./scripts/service/install-linux.sh # a NEW database starts with demo records
#
# A new database starts EMPTY, ready for the company's own data. An existing
# database is always kept exactly as it is.
#
# Uninstall (the data in .pglite-data stays):
#   sudo systemctl disable --now spir-margin && sudo rm /etc/systemd/system/spir-margin.service
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-3000}"
# This computer only, by default: the app ships a fixed administrator account.
HOST="${HOST:-127.0.0.1}"
RUN_USER="${SUDO_USER:-$(id -un)}"
# Overridable so the script itself can be exercised without touching the system.
UNIT_PATH="${UNIT_PATH:-/etc/systemd/system/spir-margin.service}"

if [[ $EUID -ne 0 ]]; then
  echo "Run this with sudo: sudo $0" >&2
  exit 1
fi

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "node was not found on PATH." >&2
  exit 1
fi

# Dependencies and the build are prepared here, as the user who will run the
# service — never as root, or the service could not write its own files.
as_user() { sudo -u "$RUN_USER" -H bash -c "cd \"$APP_DIR\" && $1"; }
if [[ ! -f "$APP_DIR/node_modules/next/dist/bin/next" ]]; then
  echo "Installing dependencies (a few minutes the first time)..."
  as_user "npm ci --no-audit --no-fund"
fi
if [[ ! -f "$APP_DIR/.next/BUILD_ID" ]]; then
  echo "Building..."
  as_user "npm run build"
fi

# How a brand-new database starts, recorded in .env.local beside the session
# secret. A value already there was chosen deliberately and is left alone.
ENV_LOCAL="$APP_DIR/.env.local"
if ! grep -q '^SPIR_SEED=' "$ENV_LOCAL" 2>/dev/null; then
  if [[ -s "$ENV_LOCAL" && -n "$(tail -c1 "$ENV_LOCAL")" ]]; then echo >> "$ENV_LOCAL"; fi
  echo "SPIR_SEED=${SPIR_SEED:-none}" >> "$ENV_LOCAL"
  chown "$RUN_USER" "$ENV_LOCAL" 2>/dev/null || true
fi

# Anything the operator already relies on — a hosted database, a signing
# secret — has to survive into the service, which does not inherit a shell.
EXTRA_ENV=""
# (SPIR_SEED is not among them: it lives in .env.local, written below, so the
# service and the file can never disagree about how a new database starts.)
for var in AUTH_SECRET DATABASE_URL PGSSL PGPOOL_MAX PGLITE_DATA_DIR; do
  if [[ -n "${!var:-}" ]]; then
    EXTRA_ENV+="Environment=${var}=${!var}"$'\n'
  fi
done

echo "Installing:"
echo "  directory : $APP_DIR"
echo "  user      : $RUN_USER"
echo "  port      : $PORT"
echo "  listen    : $HOST"

tmp="$(mktemp)"
sed -e "s|__APP_DIR__|$APP_DIR|g" \
    -e "s|__RUN_USER__|$RUN_USER|g" \
    -e "s|__PORT__|$PORT|g" \
    -e "s|__HOST__|$HOST|g" \
    -e "s|__NODE_BIN__|$NODE_BIN|g" \
    "$APP_DIR/scripts/service/spir-margin.service.template" > "$tmp"
# The extra Environment= lines are multi-line, so they go in separately.
python3 - "$tmp" <<PY
import sys, pathlib
p = pathlib.Path(sys.argv[1])
p.write_text(p.read_text().replace("__EXTRA_ENV__", """$EXTRA_ENV""".rstrip()))
PY

install -m 0644 "$tmp" "$UNIT_PATH"
rm -f "$tmp"

# The database lives beside the app, so the service user must own it.
chown -R "$RUN_USER" "$APP_DIR/.next" 2>/dev/null || true
[[ -d "$APP_DIR/.pglite-data" ]] && chown -R "$RUN_USER" "$APP_DIR/.pglite-data"

systemctl daemon-reload
systemctl enable --now spir-margin

# An entry in the applications menu that opens the app in a window of its own.
# Overridable, like UNIT_PATH, so the script can be exercised without a desktop.
USER_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)"
DESKTOP_FILE="${DESKTOP_FILE:-$USER_HOME/.local/share/applications/spir-margin.desktop}"
mkdir -p "$(dirname "$DESKTOP_FILE")"
cat > "$DESKTOP_FILE" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Spir-Margin
Comment=إدارة الأجهزة الطبية والمختبرات
Icon=$APP_DIR/public/icon-512.png
Exec=sh -c 'for b in microsoft-edge google-chrome chromium chromium-browser; do command -v "\$b" >/dev/null && exec "\$b" --app=http://localhost:$PORT/; done; exec xdg-open http://localhost:$PORT/'
Terminal=false
Categories=Office;
DESKTOP
chown "$RUN_USER" "$DESKTOP_FILE" 2>/dev/null || true

echo
systemctl --no-pager --lines=10 status spir-margin || true
echo
echo "Spir-Margin will now start with the computer, at http://localhost:$PORT"
echo "Open it from the applications menu (Spir-Margin), or install it from Settings."
