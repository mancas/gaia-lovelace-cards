#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:-}"

usage() {
  echo "Usage: $0 <major|minor|patch>"
  exit 1
}

[[ "$BUMP" =~ ^(major|minor|patch)$ ]] || usage

# Require clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "error: working tree has uncommitted changes — commit or stash first"
  exit 1
fi

CURRENT=$(node -p "require('./package.json').version")

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

NEXT="${MAJOR}.${MINOR}.${PATCH}"

echo "Bumping $CURRENT → $NEXT ($BUMP)"

# Update package.json
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '${NEXT}';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

git add package.json
git commit -m "chore(release): bump version to ${NEXT}"

TAG="v${NEXT}"
git tag -a "$TAG" -m "chore(release): ${TAG}"

echo "Pushing commit and tag $TAG to origin..."
git push origin HEAD
git push origin "$TAG"

echo "Released $TAG"
