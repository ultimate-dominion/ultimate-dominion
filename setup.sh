#!/bin/bash

# Ultimate Dominion Setup Script
# This script ensures the correct Foundry version is installed

set -e

echo "🚀 Setting up Ultimate Dominion..."

# Check if foundryup is installed
if ! command -v foundryup &> /dev/null; then
    echo "📦 Installing Foundry..."
    curl -L https://foundry.paradigm.xyz | bash
    export PATH="$HOME/.foundry/bin:$PATH"
fi

# Install the correct Foundry version
echo "🔧 Installing Foundry v0.3.0..."
foundryup --install v0.3.0

# Verify the version
echo "✅ Verifying Foundry version..."
forge --version

echo "🎉 Setup complete! Foundry v0.3.0 is ready."
echo ""
echo "To start development:"
echo "  pnpm dev"