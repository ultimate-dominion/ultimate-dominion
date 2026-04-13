#!/usr/bin/env bash
# Preflight check for `railway up`.
#
# Railway's upload API rejects contexts over ~100 MB with 413. This script
# computes the effective upload size after `.railwayignore` is applied, so
# you can catch bloat (new worktrees, asset dirs, caches) before the CLI
# does. Run from the repo root — the same directory you'd run `railway up`
# from.
#
# Exits 0 if the effective size is under 50 MB (safe margin).
# Exits 1 if it's over 50 MB — audit the top entries and update
# `.railwayignore` before deploying.
set -euo pipefail

if [ ! -f .railwayignore ]; then
  echo "FAIL: no .railwayignore in $(pwd)" >&2
  echo "Run this from the repo root." >&2
  exit 1
fi

tmp=$(mktemp -t railway-preflight)
trap 'rm -f "$tmp"' EXIT

tar -cf "$tmp" --exclude-from=.railwayignore --exclude='./.git' . 2>/dev/null

bytes=$(wc -c < "$tmp" | tr -d ' ')
mb=$(( bytes / 1024 / 1024 ))

printf 'Effective upload size: %d MB (%s bytes)\n' "$mb" "$bytes"
echo
echo 'Top 10 top-level entries in upload context:'
tar -tvf "$tmp" 2>/dev/null \
  | awk '/^-/ {
      size = $5
      path = $NF
      sub(/^\.\//, "", path)
      n = split(path, parts, "/")
      if (n >= 1 && parts[1] != "") sums[parts[1]] += size
    }
    END { for (t in sums) printf "%d %s\n", sums[t], t }' \
  | sort -rn \
  | head -10 \
  | awk '{ printf "  %6.1f MB  %s\n", $1/1024/1024, $2 }'

if [ "$mb" -ge 50 ]; then
  echo
  echo "WARNING: context is ${mb} MB — railway up may 413 near 100 MB." >&2
  echo "Audit the entries above. If any are not needed at build time," >&2
  echo "add them to .railwayignore and rerun this script." >&2
  exit 1
fi
