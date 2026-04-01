/**
 * Build-time validation for required VITE_ environment variables.
 * Runs before `vite build` on Vercel — fails fast if any are missing.
 * Skips locally (Vite loads .env.production itself).
 */

// Only validate on Vercel/CI — locally, Vite loads .env files after this script runs
if (!process.env.VERCEL && !process.env.CI) {
  console.log('⏭ Skipping env validation (local build)');
  process.exit(0);
}

const REQUIRED = [
  'VITE_ENV',
  'VITE_CHAIN_ID',
  'VITE_HTTPS_RPC_URL',
  'VITE_GAME_LIVE',
  'VITE_PRIVY_APP_ID',
  'VITE_RELAYER_URL',
  'VITE_WORLD_ADDRESS',
  'VITE_INDEXER_API_URL',
  'VITE_INDEXER_WS_URL',
  'VITE_API_URL',
];

const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('\nMissing required environment variables:\n');
  for (const key of missing) {
    console.error(`   ${key}`);
  }
  console.error('\nSet these on Vercel (Settings > Environment Variables) and redeploy.\n');
  process.exit(1);
}

console.log('All required VITE_ env vars present');
