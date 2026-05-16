#!/bin/bash
# Run this before every deploy to auto-increment the SW patch version.
# Usage: bash bump-version.sh
set -e
CURRENT=$(grep "APP_VERSION = '" sw.js | sed "s/.*APP_VERSION = '\([0-9.]*\)'.*/\1/")
IFS='.' read -ra PARTS <<< "$CURRENT"
NEW="${PARTS[0]}.${PARTS[1]}.$((PARTS[2] + 1))"
sed -i '' "s/APP_VERSION = '$CURRENT'/APP_VERSION = '$NEW'/" sw.js
echo "Bumped SW version: $CURRENT → $NEW"
