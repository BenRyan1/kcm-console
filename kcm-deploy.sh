#!/bin/bash
# kcm-deploy.sh — ONE command to deploy music-theory-pro.html
# Usage: ./kcm-deploy.sh "commit message"

set -e
cd "$(dirname "$0")"

MSG="${1:-update}"
TARGET="music-theory-pro.html"

LINES=$(wc -l < "$TARGET")
SINGLOOP=$(grep -c "_singLoop" "$TARGET" 2>/dev/null || echo 0)

if [ "$LINES" -lt 7000 ] || [ "$SINGLOOP" -lt 3 ]; then
  echo "❌ Verification failed: $LINES lines, $SINGLOOP _singLoop"
  exit 1
fi

echo "✅ Verified: $LINES lines"

git add "$TARGET"
git commit -m "$MSG" 2>/dev/null || echo "(nothing new to commit)"
git push

# The deploy hook URL is a secret, so it is NOT stored in this file.
# Put it in the KCM_DEPLOY_HOOK_URL environment variable, or in a one-line
# file at ~/.kcm-deploy-hook (outside every repo). Without it, the push
# above still deploys: Cloudflare Pages auto-deploys on every push to main.
HOOK="${KCM_DEPLOY_HOOK_URL:-}"
if [ -z "$HOOK" ] && [ -f "$HOME/.kcm-deploy-hook" ]; then HOOK="$(head -n 1 "$HOME/.kcm-deploy-hook")"; fi
if [ -z "$HOOK" ]; then
  echo "ℹ️  No deploy hook configured; relying on Pages auto-deploy from the push."
else
  curl -s -X POST "$HOOK" > /dev/null && echo "🚀 Deploy triggered — live in ~90 seconds" || echo "❌ Deploy hook failed"
fi
