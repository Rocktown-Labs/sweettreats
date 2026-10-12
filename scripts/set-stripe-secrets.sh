#!/usr/bin/env bash
set -euo pipefail

REPO="Rocktown-Labs/sweettreats"

echo "💳 Setting Stripe GitHub Secrets for $REPO"
echo "──────────────────────────────────────────────────────"

# 1. Stripe Publishable Key
read -r -p "Enter STRIPE_PUBLISHABLE_KEY (pk_live_... or pk_test_...): " STRIPE_PUBLISHABLE_KEY
if [ -n "$STRIPE_PUBLISHABLE_KEY" ]; then
  echo -n "$STRIPE_PUBLISHABLE_KEY" | gh secret set STRIPE_PUBLISHABLE_KEY -R "$REPO"
  echo "✅ STRIPE_PUBLISHABLE_KEY set successfully."
else
  echo "⚠️  Skipping STRIPE_PUBLISHABLE_KEY (empty)."
fi

# 2. Stripe Secret Key (hidden input)
read -r -s -p "Enter STRIPE_SECRET_KEY (sk_live_... or sk_test_...): " STRIPE_SECRET_KEY
echo ""
if [ -n "$STRIPE_SECRET_KEY" ]; then
  echo -n "$STRIPE_SECRET_KEY" | gh secret set STRIPE_SECRET_KEY -R "$REPO"
  echo "✅ STRIPE_SECRET_KEY set successfully."
else
  echo "⚠️  Skipping STRIPE_SECRET_KEY (empty)."
fi

# 3. Stripe Webhook Secret (hidden input)
read -r -s -p "Enter STRIPE_WEBHOOK_SECRET (whsec_...): " STRIPE_WEBHOOK_SECRET
echo ""
if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
  echo -n "$STRIPE_WEBHOOK_SECRET" | gh secret set STRIPE_WEBHOOK_SECRET -R "$REPO"
  echo "✅ STRIPE_WEBHOOK_SECRET set successfully."
else
  echo "⚠️  Skipping STRIPE_WEBHOOK_SECRET (empty)."
fi

echo "──────────────────────────────────────────────────────"
echo "🎉 Stripe secrets updated in GitHub Secrets!"
