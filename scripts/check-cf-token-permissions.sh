#!/usr/bin/env bash
# Verifies the CLOUDFLARE_API_TOKEN used by CI has the permissions Alchemy needs.
# Usage: CLOUDFLARE_API_TOKEN=<token> ./scripts/check-cf-token-permissions.sh
# The token value is read from the env (or wrangler-style prompt) — never paste it in chat.
set -euo pipefail

ACCOUNT="${CLOUDFLARE_ACCOUNT_ID:-5af47adc047fa74dcfa59048858b486c}"
TOKEN="${CLOUDFLARE_API_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  read -r -s -p "Paste the Cloudflare API token (hidden): " TOKEN
  echo ""
fi

check() {
  local label="$1" expect="$2"; shift 2
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "$@")
  if [ "$status" = "$expect" ]; then
    echo "✓ $label ($status)"
  else
    echo "✗ $label — got $status (expected $expect)"
  fi
}

echo "Probing Cloudflare token permissions for account $ACCOUNT..."

# 1. Token validity + account access
check "Token valid" 200 \
  -H "Authorization: Bearer $TOKEN" \
  "https://api.cloudflare.com/client/v4/user/tokens/verify"

# 2. Secrets Store Read — the state-store login lists stores first.
#    401/403 here = "Secrets Store: Read" missing.
check "Secrets Store Read (list stores)" 200 \
  -H "Authorization: Bearer $TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/secrets_store/stores"

# 3. Workers Scripts Read — the login derives the state-store worker URL from
#    the account's workers.dev subdomain. 401/403 = "Workers Scripts: Read" missing.
check "Workers Scripts Read (subdomain)" 200 \
  -H "Authorization: Bearer $TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/workers/subdomain"

# 4. Edge-preview upload — THE money call the state-store login retries ~25s on.
#    With permissions present it 400s (empty body reaches validation); 401/403
#    means "Workers Scripts: Edit" or "Secrets Store: Edit" is missing.
check "Edge-preview upload (Workers Scripts Write + Secrets Store Write)" 400 \
  -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/scripts/alchemy-state-store/edge-preview"

echo ""
echo "All ✓ → rerun the failed GitHub deploy run. Any ✗ → add that permission group"
echo "in the Cloudflare dashboard (My Profile → API Tokens → your token → Edit):"
echo "  Account scope: Workers Scripts (Edit), Secrets Store (Edit), D1 (Edit),"
echo "    Workers R2 Storage (Edit), Workers KV Storage (Edit), Queues (Edit),"
echo "    Pages (Edit), Account Settings (Read+Edit), Workers Tail (Read)"
echo "  Zone scope (sweettreatslr.com): Zone (Read), DNS (Edit), SSL and Certificates (Edit)"
