#!/bin/bash

# Exit on error
set -e

# Install dependencies without running scripts
HUSKY=0 pnpm install --no-frozen-lockfile --ignore-scripts

# Build TypeScript
pnpm build
