#!/usr/bin/env bash
# Sets the GitHub repo secrets + variables that the deploy workflow needs.
# Reads values from .env (dev) or .env.production (prod).
#
# Usage:
#   scripts/setup-github-secrets.sh dev  /path/to/service-account.json
#   scripts/setup-github-secrets.sh prod /path/to/service-account.json
#
# Requires: gh (authenticated via `gh auth login`).

set -euo pipefail

ENV_TARGET="${1:-}"
SA_JSON="${2:-}"

if [[ "$ENV_TARGET" != "dev" && "$ENV_TARGET" != "prod" ]]; then
  echo "Usage: $0 <dev|prod> <path/to/service-account.json>" >&2
  exit 64
fi

if [[ -z "$SA_JSON" || ! -f "$SA_JSON" ]]; then
  echo "Error: service-account JSON not found at: $SA_JSON" >&2
  exit 66
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh not installed. See docs/setup.md." >&2
  exit 69
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh not authenticated. Run: gh auth login" >&2
  exit 77
fi

# Validate JSON
if ! python3 -c "import json,sys; json.load(open('$SA_JSON'))" 2>/dev/null \
   && ! node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$SA_JSON" 2>/dev/null; then
  echo "Error: $SA_JSON is not valid JSON." >&2
  exit 65
fi

# Pick env file + secret prefix per target
if [[ "$ENV_TARGET" == "dev" ]]; then
  ENV_FILE=".env"
  PREFIX=""
  SA_SECRET="FIREBASE_SERVICE_ACCOUNT_DEV"
  PROJECT_VAR="FIREBASE_PROJECT_DEV"
  PROJECT_VALUE="acai-kilns-dev"
  APP_URL_DEFAULT="https://acai-kilns-dev.web.app"
else
  ENV_FILE=".env.production"
  PREFIX="PROD_"
  SA_SECRET="FIREBASE_SERVICE_ACCOUNT_PROD"
  PROJECT_VAR="FIREBASE_PROJECT_PROD"
  PROJECT_VALUE="acai-kilns-prod"
  APP_URL_DEFAULT="https://kilns.acaistudios.com"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found at repo root." >&2
  exit 66
fi

# Source the env file (allows # comments, simple KEY=value lines)
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Error: $name is empty in $ENV_FILE" >&2
    exit 78
  fi
}

for v in \
  NUXT_PUBLIC_FIREBASE_API_KEY \
  NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
  NUXT_PUBLIC_FIREBASE_PROJECT_ID \
  NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
  NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
  NUXT_PUBLIC_FIREBASE_APP_ID \
  NUXT_PUBLIC_TURNSTILE_SITE_KEY; do
  require_var "$v"
done

echo
echo "Will set the following on the current repo (target: $ENV_TARGET):"
echo "  Secret: $SA_SECRET   ← $SA_JSON"
for v in \
  NUXT_PUBLIC_FIREBASE_API_KEY \
  NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
  NUXT_PUBLIC_FIREBASE_PROJECT_ID \
  NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
  NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
  NUXT_PUBLIC_FIREBASE_APP_ID \
  NUXT_PUBLIC_TURNSTILE_SITE_KEY; do
  echo "  Secret: ${PREFIX}${v}"
done
echo "  Variable: $PROJECT_VAR = $PROJECT_VALUE"
echo "  Variable: ${PREFIX}NUXT_PUBLIC_APP_URL = ${NUXT_PUBLIC_APP_URL:-$APP_URL_DEFAULT}"
echo "  Variable: ${PREFIX}NUXT_PUBLIC_ENV = $ENV_TARGET"
echo
read -r -p "Proceed? [y/N] " confirm
[[ "$confirm" == "y" || "$confirm" == "Y" ]] || { echo "Aborted."; exit 0; }

echo
echo "Setting service-account secret…"
gh secret set "$SA_SECRET" < "$SA_JSON"

for v in \
  NUXT_PUBLIC_FIREBASE_API_KEY \
  NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
  NUXT_PUBLIC_FIREBASE_PROJECT_ID \
  NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
  NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
  NUXT_PUBLIC_FIREBASE_APP_ID \
  NUXT_PUBLIC_TURNSTILE_SITE_KEY; do
  echo "Setting secret ${PREFIX}${v}…"
  printf '%s' "${!v}" | gh secret set "${PREFIX}${v}"
done

echo
echo "Setting variables…"
gh variable set "$PROJECT_VAR"                   --body "$PROJECT_VALUE"
gh variable set "${PREFIX}NUXT_PUBLIC_APP_URL"   --body "${NUXT_PUBLIC_APP_URL:-$APP_URL_DEFAULT}"
gh variable set "${PREFIX}NUXT_PUBLIC_ENV"       --body "$ENV_TARGET"

echo
echo "Done. Verify with:"
echo "  gh secret list"
echo "  gh variable list"
