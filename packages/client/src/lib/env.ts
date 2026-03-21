/**
 * Environment detection and validation.
 *
 * VITE_ENV should be set on Vercel:
 *   - Production deployments: VITE_ENV=production
 *   - Preview/beta deployments: VITE_ENV=beta
 *   - Local dev: defaults to 'development'
 */

export type AppEnv = 'development' | 'beta' | 'production';

export const APP_ENV: AppEnv =
  (import.meta.env.VITE_ENV as AppEnv) ||
  (import.meta.env.DEV ? 'development' : 'production');

export const IS_BETA = APP_ENV === 'beta';
export const IS_PRODUCTION = APP_ENV === 'production';
export const IS_DEV = APP_ENV === 'development';

/** Expected world addresses per environment — prevents silent wrong-world connections */
const EXPECTED_WORLDS: Partial<Record<AppEnv, string>> = {
  beta: '0x4a54538eCD32E1827121f9edb4a87CC4C08536E5',
  production: '0x99d01939F58B965E6E84a1D167E710Abdf5764b0',
};

/**
 * Validate that the resolved world address matches the expected one for this environment.
 * Throws if mismatched — prevents connecting to wrong world in production/beta.
 */
export function validateWorldAddress(worldAddress: string): void {
  const expected = EXPECTED_WORLDS[APP_ENV];
  if (!expected) return; // development — no validation

  if (worldAddress.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(
      `[ENV MISMATCH] Expected world ${expected} for ${APP_ENV}, got ${worldAddress}. ` +
      `Check VITE_WORLD_ADDRESS and VITE_ENV on Vercel.`,
    );
  }
}
