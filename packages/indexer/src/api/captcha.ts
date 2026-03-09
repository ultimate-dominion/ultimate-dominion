import { config } from '../config.js';

/**
 * Verify a Cloudflare Turnstile CAPTCHA token.
 * Returns true if valid, false otherwise.
 */
export async function verifyCaptcha(token: string, remoteIp?: string): Promise<boolean> {
  const secret = config.captcha.turnstileSecret;
  if (!secret) {
    // Fail-closed: reject if CAPTCHA not configured (prevents bypassing in production)
    console.error('[captcha] No TURNSTILE_SECRET_KEY configured, rejecting request');
    return false;
  }

  try {
    const body: Record<string, string> = {
      secret,
      response: token,
    };
    if (remoteIp) {
      body.remoteip = remoteIp;
    }

    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await resp.json()) as { success: boolean; 'error-codes'?: string[] };
    if (!data.success) {
      console.warn('[captcha] Verification failed:', data['error-codes']);
    }
    return data.success;
  } catch (err) {
    console.error('[captcha] Verification error:', err);
    return false;
  }
}
