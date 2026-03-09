/**
 * Verify a Cloudflare Turnstile CAPTCHA token.
 * Returns true if valid, false otherwise.
 */
export declare function verifyCaptcha(token: string, remoteIp?: string): Promise<boolean>;
