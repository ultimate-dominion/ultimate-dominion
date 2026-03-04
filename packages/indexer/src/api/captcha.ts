import { config } from '../config.js';

/**
 * Verify a Cloudflare Turnstile CAPTCHA token.
 * Returns true if valid, false otherwise.
 */
export async function verifyCaptcha(token: string, remoteIp?: string): Promise<boolean> {
  const secret = config.captcha.turnstileSecret;
  if (!secret) {
    // If no secret configured, skip verification (dev mode)
    console.warn('[captcha] No TURNSTILE_SECRET_KEY configured, skipping verification');
    return true;
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
