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

curl -s -X POST https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/9dd8bf85-567f-48cf-9bff-7d9331c92814 > /dev/null && echo "🚀 Deploy triggered — live in ~90 seconds" || echo "❌ Deploy hook failed"
