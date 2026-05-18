#!/bin/bash
# ============================================================
# inject-canonicals.sh
# Injects <link rel="canonical"> and <meta name="robots">
# into KCM HTML files that are missing them.
# Run from: ~/Desktop/kcm-console
# ============================================================

REPO="$HOME/Desktop/kcm-console"
BASE="https://keyscodesandmodes.com"
CHANGED=0
SKIPPED=0

inject_canonical() {
  local FILE="$1"
  local CANONICAL="$2"
  local NOINDEX="${3:-false}"

  # Skip if canonical already present
  if grep -q 'rel="canonical"' "$FILE"; then
    echo "  ⏭  SKIP (already has canonical): $FILE"
    ((SKIPPED++))
    return
  fi

  # Build the tag(s) to inject
  local TAGS="    <link rel=\"canonical\" href=\"$CANONICAL\" />"
  if [ "$NOINDEX" = "true" ]; then
    TAGS="    <meta name=\"robots\" content=\"noindex, nofollow\" />"$'\n'"$TAGS"
  fi

  # Inject just before </head>
  if grep -qi '</head>' "$FILE"; then
    # Use perl for reliable in-place multiline replace on macOS
    perl -i -0pe "s|</head>|$TAGS\n  </head>|i" "$FILE"
    echo "  ✅ PATCHED: $FILE"
    ((CHANGED++))
  else
    echo "  ⚠️  NO </head> FOUND: $FILE — skipping"
    ((SKIPPED++))
  fi
}

echo ""
echo "═══════════════════════════════════════════"
echo "  KCM Canonical Tag Injector"
echo "  Repo: $REPO"
echo "═══════════════════════════════════════════"
echo ""

cd "$REPO" || { echo "❌ Could not cd into $REPO"; exit 1; }

# ── Root pages ───────────────────────────────────────────────
inject_canonical "index.html"            "$BASE/"
inject_canonical "about.html"            "$BASE/about.html"
inject_canonical "contact.html"          "$BASE/contact.html"
inject_canonical "offerings.html"        "$BASE/offerings.html"
inject_canonical "insights.html"         "$BASE/insights.html"
inject_canonical "lander.html"           "$BASE/lander.html"
inject_canonical "circle-of-fifths.html" "$BASE/circle-of-fifths.html"
inject_canonical "refund-policy.html"    "$BASE/refund-policy.html"
inject_canonical "privacy-policy.html"   "$BASE/privacy-policy.html"
inject_canonical "terms-of-service.html" "$BASE/terms-of-service.html"
inject_canonical "cookie-policy.html"    "$BASE/cookie-policy.html"
inject_canonical "signup.html"           "$BASE/signup.html"
inject_canonical "pricing.html"          "$BASE/pricing.html"

# ── Post-purchase / internal — noindex ───────────────────────
inject_canonical "welcome-premium.html"       "$BASE/welcome-premium.html"      "true"
inject_canonical "welcome-free-picker.html"   "$BASE/welcome-free-picker.html"  "true"

# ── Apps ─────────────────────────────────────────────────────
[ -f "apps/kcm-chromatic-universe.html" ]  && inject_canonical "apps/kcm-chromatic-universe.html"  "$BASE/apps/kcm-chromatic-universe.html"
[ -f "apps/music-theory-explorer.html" ]   && inject_canonical "apps/music-theory-explorer.html"   "$BASE/apps/music-theory-explorer.html"
[ -f "apps/rhythmic-clock.html" ]          && inject_canonical "apps/rhythmic-clock.html"          "$BASE/apps/rhythmic-clock.html"
[ -f "apps/music-theory-pro.html" ]        && inject_canonical "apps/music-theory-pro.html"        "$BASE/apps/music-theory-pro.html"

# ── Catch any other root-level HTML files not listed above ───
echo ""
echo "── Scanning for unlisted root HTML files..."
for f in *.html; do
  [ -f "$f" ] || continue
  case "$f" in
    index.html|about.html|contact.html|offerings.html|insights.html|\
    lander.html|circle-of-fifths.html|refund-policy.html|privacy-policy.html|\
    terms-of-service.html|cookie-policy.html|signup.html|pricing.html|\
    welcome-premium.html|welcome-free-picker.html)
      continue ;;  # already handled above
    *)
      echo "  🔍 Found unlisted: $f"
      inject_canonical "$f" "$BASE/$f"
      ;;
  esac
done

echo ""
echo "═══════════════════════════════════════════"
echo "  Done. Patched: $CHANGED  |  Skipped: $SKIPPED"
echo "═══════════════════════════════════════════"
echo ""
echo "Next step:"
echo "  git add -A && git commit -m \"seo: inject canonical tags into all public pages\" && git push"
echo ""