#!/usr/bin/env bash
# Starts the image with the production hardening flags and checks what nginx actually serves.
set -euo pipefail

IMAGE="${1:?usage: scripts/smoke-test.sh <image>}"
PORT="${SMOKE_PORT:-18080}"
NAME="static-portal-site-smoke-$$"
BASE_URL="http://127.0.0.1:${PORT}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/../public"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "Smoke test failed: $*" >&2
  docker logs "$NAME" >&2 || true
  exit 1
}

docker run -d --name "$NAME" \
  --read-only --tmpfs /tmp \
  --cap-drop ALL --security-opt no-new-privileges \
  -p "127.0.0.1:${PORT}:8080" \
  "$IMAGE" >/dev/null

health=""
for _ in $(seq 1 40); do
  health="$(docker inspect --format '{{.State.Health.Status}}' "$NAME")"
  if [ "$health" = healthy ]; then
    break
  fi
  sleep 1
done
[ "$health" = healthy ] || fail "container did not become healthy (status: $health)"

body="$(curl -fsS "$BASE_URL/")"
grep -Fq 'href="mailto:contact@example.invalid"' <<<"$body" || fail "contact link missing"

headers="$(curl -fsS -o /dev/null -D - "$BASE_URL/")"
for expected in \
  "content-security-policy: default-src 'none'; script-src 'self'" \
  "x-content-type-options: nosniff" \
  "x-frame-options: DENY" \
  "referrer-policy: no-referrer" \
  "cache-control: no-cache"; do
  grep -Fiq "$expected" <<<"$headers" || fail "missing header: $expected"
done
if grep -Eiq '^server: nginx/[0-9]' <<<"$headers"; then
  fail "nginx version is exposed"
fi

for file in "$PUBLIC_DIR"/js/*.js; do
  path="/js/$(basename "$file")"
  content_type="$(curl -fsS -o /dev/null -w '%{content_type}' "$BASE_URL$path")" \
    || fail "$path is not served"
  [[ "$content_type" == *javascript* ]] || fail "$path has content type $content_type"
done

for path in /css/style.css /favicon.svg; do
  curl -fsS -o /dev/null "$BASE_URL$path" || fail "$path is not served"
done

status="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/does-not-exist")"
[ "$status" = 404 ] || fail "expected 404 for unknown paths, got $status"

[ "$(curl -fsS "$BASE_URL/healthz")" = ok ] || fail "health endpoint did not answer ok"

echo "Smoke test passed."
