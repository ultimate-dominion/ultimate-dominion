// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Validates that the root vercel.json CSP connect-src includes all external
 * domains the client fetches from. A missing entry silently blocks browser
 * requests and surfaces as "Failed to fetch" — extremely hard to debug in prod.
 */
describe('CSP connect-src', () => {
  const vercelJson = JSON.parse(
    readFileSync(resolve(__dirname, '../../../vercel.json'), 'utf-8'),
  );

  const cspHeader = vercelJson.headers
    ?.find((h: { source: string }) => h.source === '/(.*)')
    ?.headers?.find(
      (h: { key: string }) => h.key === 'Content-Security-Policy',
    )?.value as string | undefined;

  const connectSrc = cspHeader
    ?.split(';')
    .find((d: string) => d.trim().startsWith('connect-src'))
    ?.trim() ?? '';

  // All external origins the client fetches from in production.
  // If you add a new external fetch, add the domain here.
  const requiredOrigins = [
    'https://ud-api.vercel.app',        // metadata upload (character creation)
    'https://auth.privy.io',            // Privy auth
    'https://*.rpc.privy.systems',      // Privy MPC signing
    'https://*.alchemy.com',            // RPC primary
    'https://rpc.ultimatedominion.com', // RPC self-hosted
    'https://8453.relay.ultimatedominion.com', // relayer
    'https://*.up.railway.app',         // indexer
  ];

  it('has a CSP header with connect-src directive', () => {
    expect(cspHeader).toBeDefined();
    expect(connectSrc).toContain('connect-src');
  });

  for (const origin of requiredOrigins) {
    it(`includes ${origin}`, () => {
      expect(connectSrc).toContain(origin);
    });
  }

  // Beta API should also be allowed (staging deployments share the CSP)
  it('includes beta API domain', () => {
    expect(connectSrc).toContain('https://ud-api-beta.vercel.app');
  });
});
