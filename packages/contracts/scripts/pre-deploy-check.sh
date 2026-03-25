#!/usr/bin/env bash
# Pre-deploy safety check — prevents deploying to the wrong world.
# Called automatically by deploy:testnet and deploy:mainnet.
# Aborts if WORLD_ADDRESS is not set or doesn't look right.

set -euo pipefail

ENV_LABEL="${1:-unknown}"

if [ -z "${WORLD_ADDRESS:-}" ]; then
  echo ""
  echo "ERROR: WORLD_ADDRESS is not set."
  echo ""
  echo "  Never run 'mud deploy' directly. Use:"
  echo "    pnpm deploy:testnet   (beta)"
  echo "    pnpm deploy:mainnet   (production)"
  echo ""
  exit 1
fi

if [ -z "${RPC_URL:-}" ]; then
  echo "ERROR: RPC_URL is not set."
  exit 1
fi

echo ""
echo "=== Deploy Check ==="
echo "  Environment: ${ENV_LABEL}"
echo "  World:       ${WORLD_ADDRESS}"
echo "  RPC:         ${RPC_URL%%\?*}"
echo "  Deployer:    $(cast wallet address --private-key "${PRIVATE_KEY}" 2>/dev/null || echo 'unknown')"
echo "===================="
echo ""

# Verify the world exists on-chain (basic code check)
CODE=$(cast code "${WORLD_ADDRESS}" --rpc-url "${RPC_URL}" 2>/dev/null || echo "0x")
if [ "${CODE}" = "0x" ] || [ -z "${CODE}" ]; then
  echo "WARNING: No contract found at ${WORLD_ADDRESS}."
  echo "  This will create a FRESH world, not upgrade an existing one."
  echo ""
  read -r -t 10 -p "Continue? [y/N] " REPLY 2>/dev/null || REPLY="y"
  if [[ ! "${REPLY}" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
fi
