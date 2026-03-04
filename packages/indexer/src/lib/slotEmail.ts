import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const IS_DEV_MODE = !RESEND_API_KEY;

let resend: Resend | null = null;
if (!IS_DEV_MODE) {
  try {
    resend = new Resend(RESEND_API_KEY);
    console.log('[slotEmail] Resend client initialized');
  } catch (error) {
    console.error('[slotEmail] Failed to initialize Resend:', error);
  }
} else {
  console.log('[slotEmail] Dev mode — emails logged to console');
}

const FROM_ADDRESS = 'The Herald <herald@ultimatedominion.com>';
const SITE = 'https://ultimatedominion.com';

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background:#12100E;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#12100E;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr><td style="height:2px;background:linear-gradient(90deg,transparent,#C87A2A,transparent);"></td></tr>
          <tr>
            <td style="padding:40px 32px;background:#1A1714;border-left:1px solid #2A2520;border-right:1px solid #2A2520;">
              ${content}
            </td>
          </tr>
          <tr><td style="height:2px;background:linear-gradient(90deg,transparent,#C87A2A,transparent);"></td></tr>
          <tr>
            <td style="padding:24px 32px;text-align:center;">
              <p style="margin:0;font-family:'Cinzel',Georgia,serif;font-size:11px;color:#5A5347;letter-spacing:0.2em;text-transform:uppercase;">
                Ultimate Dominion
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function slotOpenHtml(): string {
  return emailWrapper(`
    <h1 style="margin:0 0 24px;font-family:'Cinzel',Georgia,serif;font-size:22px;font-weight:600;color:#C87A2A;letter-spacing:0.1em;text-align:center;text-transform:uppercase;">A Slot Has Opened</h1>
    <p style="margin:0 0 16px;font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;line-height:1.7;color:#C4B89E;">The gates are open. A place in the world awaits you &mdash; but not for long.</p>
    <p style="margin:0 0 24px;font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;line-height:1.7;color:#C4B89E;"><strong style="color:#C87A2A;">You have 2 minutes to enter.</strong> If you do not claim your slot, it will pass to the next soul in line.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0 24px;">
          <a href="${SITE}" style="display:inline-block;padding:14px 32px;background:#C87A2A;color:#12100E;font-family:'Cinzel',Georgia,serif;font-size:15px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;border-radius:2px;">Enter the World</a>
        </td>
      </tr>
    </table>
    <hr style="border:none;border-top:1px solid #2A2520;margin:0 0 16px;" />
    <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;line-height:1.6;color:#5A5347;text-align:center;">The world does not wait. Neither should you.</p>
  `);
}

/**
 * Send a "your slot is open" email to a player in the queue.
 */
export async function sendSlotOpenEmail(email: string): Promise<boolean> {
  if (IS_DEV_MODE) {
    console.log(`[slotEmail] [DEV] Slot open email to: ${email}`);
    return true;
  }
  if (!resend) {
    console.error('[slotEmail] Resend client not initialized');
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: 'A Slot Has Opened — Enter Now',
      html: slotOpenHtml(),
      tags: [{ name: 'category', value: 'slot-open' }],
    });
    if (error) {
      console.error('[slotEmail] Resend error:', error);
      return false;
    }
    console.log(`[slotEmail] Slot open email sent to: ${email}`);
    return true;
  } catch (err) {
    console.error('[slotEmail] Exception:', err);
    return false;
  }
}
