#!/usr/bin/env bash
# Install Spir-Margin as a systemd service so it starts with the computer.
#
#   sudo ./scripts/service/install-linux.sh            # port 3000, current user
#   sudo PORT=8080 ./scripts/service/install-linux.sh  # a different port
#
# Uninstall:
#   sudo systemctl disable --now spir-margin && sudo rm /etc/systemd/system/spir-margin.service
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-3000}"
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

if [[ ! -d "$APP_DIR/.next" ]]; then
  echo "No build found. Run 'npm run build' first." >&2
  exit 1
fi

# Anything the operator already relies on — a hosted database, a signing
# secret — has to survive into the service, which does not inherit a shell.
EXTRA_ENV=""
for var in AUTH_SECRET DATABASE_URL PGSSL PGPOOL_MAX SPIR_SEED PGLITE_DATA_DIR; do
  if [[ -n "${!var:-}" ]]; then
    EXTRA_ENV+="Environment=${var}=${!var}"$'\n'
  fi
done

echo "Installing:"
echo "  directory : $APP_DIR"
echo "  user      : $RUN_USER"
echo "  port      : $PORT"

tmp="$(mktemp)"
sed -e "s|__APP_DIR__|$APP_DIR|g" \
    -e "s|__RUN_USER__|$RUN_USER|g" \
    -e "s|__PORT__|$PORT|g" \
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

echo
systemctl --no-pager --lines=10 status spir-margin || true
echo
echo "Spir-Margin will now start with the computer, at http://localhost:$PORT"
echo "Open that address, then install it from Settings."
