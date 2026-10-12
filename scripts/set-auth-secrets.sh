#!/usr/bin/env bash
set -euo pipefail

REPO="Rocktown-Labs/sweettreats"

echo "🔐 Setting Google & Resend GitHub Secrets for $REPO"
echo "──────────────────────────────────────────────────────"

# 1. Google Client ID
read -r -p "Enter GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
if [ -n "$GOOGLE_CLIENT_ID" ]; then
  echo -n "$GOOGLE_CLIENT_ID" | gh secret set GOOGLE_CLIENT_ID -R "$REPO"
  echo "✅ GOOGLE_CLIENT_ID set successfully."
else
  echo "⚠️  Skipping GOOGLE_CLIENT_ID (empty)."
fi

# 2. Google Client Secret (hidden input)
read -r -s -p "Enter GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET
echo ""
if [ -n "$GOOGLE_CLIENT_SECRET" ]; then
  echo -n "$GOOGLE_CLIENT_SECRET" | gh secret set GOOGLE_CLIENT_SECRET -R "$REPO"
  echo "✅ GOOGLE_CLIENT_SECRET set successfully."
else
  echo "⚠️  Skipping GOOGLE_CLIENT_SECRET (empty)."
fi

# 3. Resend API Key (hidden input)
read -r -s -p "Enter RESEND_API_KEY (starts with re_...): " RESEND_API_KEY
echo ""
if [ -n "$RESEND_API_KEY" ]; then
  echo -n "$RESEND_API_KEY" | gh secret set RESEND_API_KEY -R "$REPO"
  echo "✅ RESEND_API_KEY set successfully."
else
  echo "⚠️  Skipping RESEND_API_KEY (empty)."
fi

echo "──────────────────────────────────────────────────────"
echo "🎉 Google & Resend secrets updated in GitHub Secrets!"
