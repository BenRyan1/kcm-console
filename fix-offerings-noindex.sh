#!/bin/bash
cd ~/Desktop/kcm-console

# 1. Add noindex to offerings.html right after <head>
sed -i '' 's|<head>|<head>\n    <meta name="robots" content="noindex, nofollow">|' offerings.html

# Verify
echo "=== offerings.html lines 1-6 ==="
head -6 offerings.html

# 2. Copy the robots.txt into repo
# (drag the robots.txt from Claude's output into this folder first, OR paste below)
cat > robots.txt << 'ROBOTS'
User-agent: *

# ── Private / gated pages — never index ───────────────────
Disallow: /offerings.html
Disallow: /gate.html
Disallow: /auth-guard-snippet.html
Disallow: /mtp-fixed.html
Disallow: /music-theory-pro-MASTER.html

# ── Internal / dev files ──────────────────────────────────
Disallow: /modal-stencil-player.html
Disallow: /KCM-CREPE-Integration-Spec.html
Disallow: /KCM-Yamaha-OnePager.html

# ── Allow public apps ─────────────────────────────────────
Allow: /music-theory-pro.html
Allow: /kcm-chromatic-universe.html
Allow: /kcm-sound-observatory.html
Allow: /kcm-clock-wheel.html
Allow: /circle-of-fifths.html

Sitemap: https://console.keyscodesandmodes.com/sitemap.xml
ROBOTS

# 3. Commit and push both
git add offerings.html robots.txt
git commit -m "fix: noindex on offerings.html + add robots.txt to block private pages"
git push

echo ""
echo "✅ Done — Cloudflare Pages will deploy in ~60 seconds."
echo "Then go to GSC > URL Inspection > console.keyscodesandmodes.com/offerings.html > Request Removal"
