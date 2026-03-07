import { Resend } from 'resend';
import type { AlertEvent, ServiceStatus } from './types.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const ALERT_EMAIL = process.env.ALERT_EMAIL || '';
const IS_DEV_MODE = !RESEND_API_KEY || !ALERT_EMAIL;

let resend: Resend | null = null;
if (!IS_DEV_MODE) {
  try {
    resend = new Resend(RESEND_API_KEY);
    console.log('[monitor] Alert emails enabled');
  } catch (error) {
    console.error('[monitor] Failed to initialize Resend:', error);
  }
} else {
  console.log('[monitor] Dev mode — alerts logged to console');
}

const FROM_ADDRESS = 'UD Watchdog <herald@ultimatedominion.com>';
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
const cooldowns = new Map<string, number>();

function statusEmoji(status: ServiceStatus): string {
  if (status === 'up') return '\u2705';
  if (status === 'down') return '\u{1F534}';
  if (status === 'degraded') return '\u{1F7E1}';
  return '\u26AA';
}

function alertHtml(event: AlertEvent): string {
  const time = new Date(event.timestamp).toISOString();
  return `<!DOCTYPE html>
<html><body style="font-family:monospace;background:#1a1a1a;color:#ccc;padding:20px;">
<h2 style="color:${event.newStatus === 'up' ? '#4ade80' : event.newStatus === 'down' ? '#f87171' : '#facc15'};">
  ${statusEmoji(event.newStatus)} [${event.newStatus.toUpperCase()}] ${event.service}
</h2>
<p><strong>Previous:</strong> ${event.previousStatus} → <strong>Current:</strong> ${event.newStatus}</p>
${event.details ? `<p><strong>Details:</strong> ${event.details}</p>` : ''}
<p style="color:#666;font-size:12px;">${time}</p>
<hr style="border-color:#333;">
<p style="color:#666;font-size:11px;">UD Infrastructure Monitor</p>
</body></html>`;
}

export async function sendAlert(event: AlertEvent): Promise<void> {
  const key = `${event.service}:${event.newStatus}`;
  const now = Date.now();
  const lastSent = cooldowns.get(key) || 0;
  if (now - lastSent < COOLDOWN_MS) return;

  const prefix = event.newStatus === 'up' ? 'RECOVERED' : event.newStatus.toUpperCase();
  const subject = `[${prefix}] ${event.service}${event.details ? ` — ${event.details}` : ''}`;

  if (IS_DEV_MODE) {
    console.log(`[monitor] [ALERT] ${subject}`);
    cooldowns.set(key, now);
    return;
  }

  if (!resend) return;

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: ALERT_EMAIL,
      subject,
      html: alertHtml(event),
      tags: [{ name: 'category', value: 'infra-alert' }],
    });
    if (error) {
      console.error('[monitor] Alert email error:', error);
      return;
    }
    cooldowns.set(key, now);
    console.log(`[monitor] Alert sent: ${subject}`);
  } catch (err) {
    console.error('[monitor] Alert exception:', err);
  }
}
