#!/bin/bash
# kcm-deploy.sh — ONE command to build and deploy music-theory-pro.html
# Usage: ./kcm-deploy.sh "commit message"
# Keep this file in ~/Desktop/kcm-console/

set -e
cd "$(dirname "$0")"

MSG="${1:-update}"
MASTER="music-theory-pro-MASTER.html"
TARGET="music-theory-pro.html"

# 1. Check master exists
if [ ! -f "$MASTER" ]; then
  echo "❌ $MASTER not found — run setup first"
  exit 1
fi

# 2. Copy master to target
cp "$MASTER" "$TARGET"

# 3. Verify
LINES=$(wc -l < "$TARGET")
SINGLOOP=$(grep -c "_singLoop" "$TARGET" 2>/dev/null || echo 0)

if [ "$LINES" -lt 7000 ] || [ "$SINGLOOP" -lt 3 ]; then
  echo "❌ Verification failed: $LINES lines, $SINGLOOP _singLoop"
  exit 1
fi

echo "✅ Verified: $LINES lines, _singLoop ×$SINGLOOP"

# 4. Commit and push
git add "$TARGET"
git commit -m "$MSG" || echo "(nothing new to commit)"
git push

# 5. Deploy via hook
curl -s -X POST https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/9dd8bf85-567f-48cf-9bff-7d9331c92814 | python3 -c "import sys,json; d=json.load(sys.stdin); print('🚀 Deploy triggered:', d['result']['id'] if d['success'] else '❌ FAILED')"

echo ""
echo "✅ Done. Live in ~90 seconds."
echo "   Verify: fetch('/music-theory-pro.html?v='+Date.now(),{cache:'no-store'}).then(r=>r.text()).then(s=>console.log(s.split('\\n').length,'lines'))"
