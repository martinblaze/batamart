#!/usr/bin/env bash
# Calls one BataMart notification slot. Usage: notify-slot.sh <1..6>
# Reads BATAMART_URL and SLOT_CRON_SECRET from /etc/batamart/notify-scheduler.env
# (or the file named in NOTIFY_ENV_FILE). Nothing secret lives in this repo.
# A slot can take more than one call on a big day: the endpoint answers
# "done":false when it ran out of time, and this script calls again (up to 8 times).
set -euo pipefail

SLOT="${1:-}"
case "$SLOT" in 1|2|3|4|5|6) ;; *) echo "usage: $0 <1..6>" >&2; exit 2;; esac

ENV_FILE="${NOTIFY_ENV_FILE:-/etc/batamart/notify-scheduler.env}"
[ -r "$ENV_FILE" ] || { echo "cannot read $ENV_FILE" >&2; exit 2; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
: "${BATAMART_URL:?BATAMART_URL missing in $ENV_FILE}"
: "${SLOT_CRON_SECRET:?SLOT_CRON_SECRET missing in $ENV_FILE}"

URL="${BATAMART_URL%/}/api/cron/notify-slot?slot=${SLOT}"

for attempt in 1 2 3 4 5 6 7 8; do
  # The secret goes through a config on stdin so it never shows in `ps`.
  ESC_SECRET="$(printf '%s' "$SLOT_CRON_SECRET" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"  # escape \ and " for the curl config
  BODY="$(printf 'header = "x-slot-secret: %s"\n' "$ESC_SECRET" \
    | curl -sS --max-time 90 -X POST -K - -w '\n%{http_code}' "$URL" || true)"
  CODE="$(printf '%s' "$BODY" | tail -n1)"
  JSON="$(printf '%s' "$BODY" | sed '$d')"
  echo "$(date -Is) slot=$SLOT attempt=$attempt http=$CODE $JSON"
  case "$CODE" in
    200) printf '%s' "$JSON" | grep -q '"done":true' && exit 0 ;;
    401|503) exit 1 ;;   # wrong or missing secret: retrying will not help
  esac
  sleep 5
done
exit 1
