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

/**
 * Validate that a world address is set. The address itself comes from
 * VITE_WORLD_ADDRESS (set on Vercel per environment) — no hardcoded
 * addresses here so deploys never go stale.
 */
export function validateWorldAddress(worldAddress: string): void {
  if (!worldAddress) {
    throw new Error(
      `[ENV] VITE_WORLD_ADDRESS is not set. Check Vercel env vars for ${APP_ENV}.`,
    );
  }
}
