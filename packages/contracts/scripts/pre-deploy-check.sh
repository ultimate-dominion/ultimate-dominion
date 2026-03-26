#!/usr/bin/env bash
# Pre-deploy safety check — prevents deploying to the wrong world.
# Called automatically by deploy:testnet and deploy:mainnet.
# Aborts if WORLD_ADDRESS doesn't match the canonical address for the environment.
#
# NEVER silently create a fresh world. If the address isn't recognized or
# the contract doesn't exist on-chain, this script kills the deploy.

set -euo pipefail

# ── Canonical world addresses (update here when creating a new world) ──
BETA_WORLD="0xDc34AC3b06fa0ed899696A72B7706369864E5678"
PROD_WORLD="0x99d01939F58B965E6E84a1D167E710Abdf5764b0"

ENV_LABEL="${1:-unknown}"

# ── Required env vars ──
if [ -z "${WORLD_ADDRESS:-}" ]; then
  echo ""
  echo "FATAL: WORLD_ADDRESS is not set."
  echo ""
  echo "  Never run 'mud deploy' directly. Use:"
  echo "    pnpm deploy:testnet   (beta)"
  echo "    pnpm deploy:mainnet   (production)"
  echo ""
  exit 1
fi

if [ -z "${RPC_URL:-}" ]; then
  echo "FATAL: RPC_URL is not set."
  exit 1
fi

# ── Validate address matches environment ──
case "${ENV_LABEL}" in
  beta)
    if [ "${WORLD_ADDRESS}" != "${BETA_WORLD}" ]; then
      echo ""
      echo "FATAL: WORLD_ADDRESS does not match the canonical beta world."
      echo "  Got:      ${WORLD_ADDRESS}"
      echo "  Expected: ${BETA_WORLD}"
      echo ""
      echo "  If you intentionally changed the beta world, update BETA_WORLD in"
      echo "  scripts/pre-deploy-check.sh first. This prevents accidental deploys"
      echo "  to orphaned or wrong worlds."
      echo ""
      exit 1
    fi
    ;;
  production)
    if [ "${WORLD_ADDRESS}" != "${PROD_WORLD}" ]; then
      echo ""
      echo "FATAL: WORLD_ADDRESS does not match the canonical production world."
      echo "  Got:      ${WORLD_ADDRESS}"
      echo "  Expected: ${PROD_WORLD}"
      echo ""
      echo "  If you intentionally changed the production world, update PROD_WORLD in"
      echo "  scripts/pre-deploy-check.sh first. This prevents accidental deploys"
      echo "  to orphaned or wrong worlds."
      echo ""
      exit 1
    fi
    ;;
  *)
    echo ""
    echo "FATAL: Unknown environment '${ENV_LABEL}'."
    echo "  pre-deploy-check.sh expects 'beta' or 'production'."
    echo ""
    exit 1
    ;;
esac

echo ""
echo "=== Deploy Check ==="
echo "  Environment: ${ENV_LABEL}"
echo "  World:       ${WORLD_ADDRESS}"
echo "  RPC:         ${RPC_URL%%\?*}"
echo "  Deployer:    $(cast wallet address --private-key "${PRIVATE_KEY}" 2>/dev/null || echo 'unknown')"
echo "===================="
echo ""

# ── Verify the world exists on-chain ──
CODE=$(cast code "${WORLD_ADDRESS}" --rpc-url "${RPC_URL}" 2>/dev/null || echo "0x")
if [ "${CODE}" = "0x" ] || [ -z "${CODE}" ]; then
  echo ""
  echo "FATAL: No contract found at ${WORLD_ADDRESS} on ${RPC_URL%%\?*}."
  echo ""
  echo "  This means either:"
  echo "    1. The RPC is wrong/unreachable"
  echo "    2. The address is wrong"
  echo "    3. The contract was destroyed (shouldn't happen)"
  echo ""
  echo "  Refusing to deploy. Fix the address or RPC and try again."
  echo "  NEVER deploy to an empty address — that creates an orphaned world."
  echo ""
  exit 1
fi
