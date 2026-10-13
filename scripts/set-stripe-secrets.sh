#!/usr/bin/env bash
set -euo pipefail

REPO="Rocktown-Labs/sweettreats"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "💳 Setting Stripe Secrets (GitHub + Local .env)"
echo "──────────────────────────────────────────────────────────"

# 1. Stripe Publishable Key
read -r -p "Enter STRIPE_PUBLISHABLE_KEY (pk_live_... or pk_test_...): " STRIPE_PUBLISHABLE_KEY

# 2. Stripe Secret Key (hidden input)
read -r -s -p "Enter STRIPE_SECRET_KEY (sk_live_... or sk_test_...): " STRIPE_SECRET_KEY
echo ""

# 3. Stripe Webhook Secret (hidden input)
read -r -s -p "Enter STRIPE_WEBHOOK_SECRET (whsec_...): " STRIPE_WEBHOOK_SECRET
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

if [ -n "$STRIPE_PUBLISHABLE_KEY" ]; then
  echo -n "$STRIPE_PUBLISHABLE_KEY" | gh secret set STRIPE_PUBLISHABLE_KEY -R "$REPO"
  upsert_env "STRIPE_PUBLISHABLE_KEY" "$STRIPE_PUBLISHABLE_KEY"
  echo "✅ STRIPE_PUBLISHABLE_KEY saved to GitHub Secrets and local .env."
fi

if [ -n "$STRIPE_SECRET_KEY" ]; then
  echo -n "$STRIPE_SECRET_KEY" | gh secret set STRIPE_SECRET_KEY -R "$REPO"
  upsert_env "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY"
  echo "✅ STRIPE_SECRET_KEY saved to GitHub Secrets and local .env."
fi

if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
  echo -n "$STRIPE_WEBHOOK_SECRET" | gh secret set STRIPE_WEBHOOK_SECRET -R "$REPO"
  upsert_env "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET"
  echo "✅ STRIPE_WEBHOOK_SECRET saved to GitHub Secrets and local .env."
fi

echo "──────────────────────────────────────────────────────────"
echo "🎉 Stripe secrets saved to both GitHub Secrets and packages/infra/.env!"
echo ""
read -r -p "Deploy to production now to apply these secrets to Cloudflare? (Y/n): " DEPLOY_NOW
if [[ "$DEPLOY_NOW" =~ ^[Yy] ]] || [ -z "$DEPLOY_NOW" ]; then
  echo "🚀 Deploying to production via Alchemy..."
  bun --cwd "$ROOT_DIR/packages/infra" alchemy deploy --stage prod --yes
  echo "✅ Deployed live to production with all secrets bound!"
fi
