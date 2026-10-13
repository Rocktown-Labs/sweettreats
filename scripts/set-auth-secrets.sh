#!/usr/bin/env bash
set -euo pipefail

REPO="Rocktown-Labs/sweettreats"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🔐 Setting Google & Resend Secrets (GitHub + Local .env)"
echo "──────────────────────────────────────────────────────────"

# 1. Google Client ID
read -r -p "Enter GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID

# 2. Google Client Secret (hidden input)
read -r -s -p "Enter GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET
echo ""

# 3. Resend API Key (hidden input)
read -r -s -p "Enter RESEND_API_KEY (starts with re_...): " RESEND_API_KEY
echo ""

upsert_env() {
  local key="$1"
  local val="$2"
  if [ -n "$val" ]; then
    KEY="$key" VAL="$val" bun -e '
      import fs from "node:fs";
      const key = process.env.KEY;
      const val = process.env.VAL;
      for (const file of ["packages/infra/.env", ".env"]) {
        let content = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
        const line = `${key}="${val}"`;
        const regex = new RegExp(`^${key}=.*`, "m");
        if (regex.test(content)) {
          content = content.replace(regex, line);
        } else {
          content = content.trimEnd() + (content.length ? "\n" : "") + line + "\n";
        }
        fs.writeFileSync(file, content, "utf8");
      }
    '
  fi
}

# Apply to GitHub Secrets & local .env
if [ -n "$GOOGLE_CLIENT_ID" ]; then
  echo -n "$GOOGLE_CLIENT_ID" | gh secret set GOOGLE_CLIENT_ID -R "$REPO"
  upsert_env "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID"
  echo "✅ GOOGLE_CLIENT_ID saved to GitHub Secrets and local .env."
fi

if [ -n "$GOOGLE_CLIENT_SECRET" ]; then
  echo -n "$GOOGLE_CLIENT_SECRET" | gh secret set GOOGLE_CLIENT_SECRET -R "$REPO"
  upsert_env "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET"
  echo "✅ GOOGLE_CLIENT_SECRET saved to GitHub Secrets and local .env."
fi

if [ -n "$RESEND_API_KEY" ]; then
  echo -n "$RESEND_API_KEY" | gh secret set RESEND_API_KEY -R "$REPO"
  upsert_env "RESEND_API_KEY" "$RESEND_API_KEY"
  echo "✅ RESEND_API_KEY saved to GitHub Secrets and local .env."
fi

echo "──────────────────────────────────────────────────────────"
echo "🎉 Secrets saved to both GitHub Secrets and packages/infra/.env!"
echo ""
read -r -p "Deploy to production now to apply these secrets to Cloudflare? (Y/n): " DEPLOY_NOW
if [[ "$DEPLOY_NOW" =~ ^[Yy] ]] || [ -z "$DEPLOY_NOW" ]; then
  echo "🚀 Deploying to production via Alchemy..."
  bun --cwd "$ROOT_DIR/packages/infra" alchemy deploy --stage prod --yes
  echo "✅ Deployed live to production with all secrets bound!"
fi
