import { Request, Response } from "express";
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID || '';

export default async function unsubscribe(req: Request, res: Response) {
  // Only GET — this is a link clicked from an email
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  const token = req.query.token as string;
  if (!token) {
    return res.status(400).send(page("Invalid unsubscribe link."));
  }

  let email: string;
  try {
    email = Buffer.from(token, 'base64url').toString('utf-8');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error();
  } catch {
    return res.status(400).send(page("Invalid unsubscribe link."));
  }

  if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
    console.error('[unsubscribe] Missing RESEND_API_KEY or RESEND_AUDIENCE_ID');
    return res.status(500).send(page("Something went wrong. Please try again later."));
  }

  try {
    const resend = new Resend(RESEND_API_KEY);

    // Find contact by email
    const { data: contacts } = await resend.contacts.list({ audienceId: RESEND_AUDIENCE_ID });
    const contact = contacts?.data?.find(c => c.email.toLowerCase() === email.toLowerCase());

    if (!contact) {
      return res.send(page("You've been unsubscribed."));
    }

    // Update contact to unsubscribed
    await resend.contacts.update({
      audienceId: RESEND_AUDIENCE_ID,
      id: contact.id,
      unsubscribed: true,
    });

    console.log(`[unsubscribe] Unsubscribed: ${email}`);
    return res.send(page("You've been unsubscribed. You won't receive any more emails from us."));
  } catch (err) {
    console.error('[unsubscribe] Error:', err);
    return res.status(500).send(page("Something went wrong. Please try again later."));
  }
}

function page(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unsubscribe — Ultimate Dominion</title>
</head>
<body style="margin:0;padding:60px 20px;font-family:Georgia,serif;background:#12100E;color:#C4B89E;text-align:center;">
  <div style="max-width:400px;margin:0 auto;">
    <p style="font-size:13px;letter-spacing:0.15em;color:#C87A2A;text-transform:uppercase;margin-bottom:32px;">Ultimate Dominion</p>
    <p style="font-size:18px;line-height:1.6;">${message}</p>
  </div>
</body>
</html>`;
}
