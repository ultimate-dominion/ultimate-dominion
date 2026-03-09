import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const RELAYER_URL = process.env.RELAYER_URL || '';
const RELAYER_API_KEY = process.env.RELAYER_API_KEY || '';

// Disable Vercel body parsing — we need the raw body for signature verification
export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe/webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[stripe/webhook] Signature verification failed:', message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Only handle completed checkout sessions
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.payment_status !== 'paid') {
    console.log(`[stripe/webhook] Session ${session.id} not paid, skipping`);
    return res.status(200).json({ received: true });
  }

  const ownerAddress = session.metadata?.ownerAddress;
  const ethAmount = session.metadata?.ethAmount;

  if (!ownerAddress || !ethAmount) {
    console.error(`[stripe/webhook] Missing metadata on session ${session.id}`);
    return res.status(200).json({ received: true, error: 'Missing metadata' });
  }

  // Forward to relayer for Uniswap swap
  if (!RELAYER_URL || !RELAYER_API_KEY) {
    console.error('[stripe/webhook] Missing RELAYER_URL or RELAYER_API_KEY');
    return res.status(500).json({ error: 'Relayer not configured' });
  }

  try {
    const relayerRes = await fetch(`${RELAYER_URL}/gold-purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RELAYER_API_KEY}`,
      },
      body: JSON.stringify({
        ownerAddress,
        ethAmount,
        stripeSessionId: session.id,
      }),
    });

    const result = await relayerRes.json();

    if (!relayerRes.ok) {
      console.error(`[stripe/webhook] Relayer error for session ${session.id}:`, result);
      // Return 500 so Stripe retries
      return res.status(500).json({ error: 'Relayer swap failed' });
    }

    console.log(`[stripe/webhook] Gold purchase fulfilled for ${ownerAddress} | session: ${session.id} | relayer:`, result);
    return res.status(200).json({ received: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe/webhook] Failed to call relayer for session ${session.id}:`, message);
    // Return 500 so Stripe retries
    return res.status(500).json({ error: 'Relayer unreachable' });
  }
}
