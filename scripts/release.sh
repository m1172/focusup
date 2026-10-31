#!/usr/bin/env bash
# One command from source to both stores: bump, check, regenerate, build and upload.
#   npm run release                 both platforms, next build number
#   npm run release -- 1.0.1        new user-visible version
#   npm run release -- --ios        only iOS (or --android)
#   npm run release -- --no-bump    rebuild the current number (after a failed upload)
# One-time setup is in docs/local-release-build.md.
set -euo pipefail
cd "$(dirname "$0")/.."

ios=1 android=1 bump=1 version=""
for arg in "$@"; do
  case "$arg" in
    --ios) android=0 ;;
    --android) ios=0 ;;
    --no-bump) bump=0 ;;
    [0-9]*.[0-9]*.[0-9]*) version="$arg" ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

export LANG="${LANG:-en_US.UTF-8}"
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

step() { printf '\n\033[1;35m==> %s\033[0m\n' "$1"; }

if [ "$android" = 1 ] && [ ! -f keys/google-play-service-account.json ]; then
  echo "Missing keys/google-play-service-account.json (Google Play upload key). See docs/local-release-build.md." >&2
  exit 1
fi

if [ "$bump" = 1 ]; then step "Raising the build number"; node scripts/bump-build.js $version; fi
step "Checking release settings, lint, types and tests"
npm run release:check
step "Regenerating ios/ and android/"
npx expo prebuild

if [ "$ios" = 1 ]; then
  step "Building iOS"
  rm -rf build/Vaqtim.xcarchive build/ios
  npm run build:ios
  step "Uploading to App Store Connect (TestFlight)"
  npm run upload:ios
fi

if [ "$android" = 1 ]; then
  step "Building Android"
  npm run build:android
  step "Uploading to Google Play (internal testing, draft)"
  npm run upload:android
fi

step "Done: $(node -p "const e=require('./app.json').expo; e.version+' (iOS '+e.ios.buildNumber+', Android '+e.android.versionCode+')'")"
echo "Next: test it in TestFlight / Play internal testing, then submit for review in the store consoles."
