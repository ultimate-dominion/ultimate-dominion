#!/bin/bash

# Exit on error
set -e

# Copy production package.json
cp package.prod.json package.json

# Clean install dependencies
npm install --production

# Build TypeScript
npm run build
