#!/bin/bash
# Verifies that MUD CLI WorldProxy patches are applied.
# Run after pnpm install to confirm patches survived.

CLI_FILE="node_modules/@latticexyz/cli/dist/commands-IDBOJLTZ.js"

if [ ! -f "$CLI_FILE" ]; then
  echo "ERROR: MUD CLI not found at $CLI_FILE"
  echo "Run pnpm install first."
  exit 1
fi

PATCH_COUNT=$(grep -c "PATCHED:" "$CLI_FILE")
FILTER_COUNT=$(grep -c "\.filter(Boolean)" "$CLI_FILE")

echo "MUD CLI WorldProxy Patch Verification"
echo "======================================"
echo "  PATCHED markers: $PATCH_COUNT (expected: 4)"
echo "  .filter(Boolean): $FILTER_COUNT (expected: 3+)"

if [ "$PATCH_COUNT" -ge 4 ] && [ "$FILTER_COUNT" -ge 3 ]; then
  echo ""
  echo "All patches applied. Safe to deploy."
  exit 0
else
  echo ""
  echo "WARNING: Patches missing! Run 'pnpm install' from repo root."
  echo "If patches still missing, check patches/@latticexyz__cli@2.2.23.patch"
  exit 1
fi
