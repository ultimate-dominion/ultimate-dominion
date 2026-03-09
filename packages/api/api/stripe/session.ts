import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

// Tier definitions: USD cents + ETH amount (wei string)
const TIERS: Record<string, { cents: number; label: string; ethAmount: string }> = {
  '1': {
    cents: 500,
    label: '~500 Gold',
    ethAmount: process.env.GOLD_TIER_1_ETH || '2000000000000000', // 0.002 ETH
  },
  '2': {
    cents: 1000,
    label: '~1,000 Gold',
    ethAmount: process.env.GOLD_TIER_2_ETH || '4000000000000000', // 0.004 ETH
  },
  '3': {
    cents: 2500,
    label: '~2,500 Gold',
    ethAmount: process.env.GOLD_TIER_3_ETH || '10000000000000000', // 0.01 ETH
  },
};

// Base URLs for redirect — infer from request origin or use env
function getBaseUrl(req: VercelRequest): string {
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    try {
      const url = new URL(typeof origin === 'string' ? origin : origin[0]);
      return url.origin;
    } catch { /* fall through */ }
  }
  return process.env.CLIENT_URL || 'https://beta.ultimatedominion.com';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const { characterId, ownerAddress, tier } = req.body ?? {};

  if (!ownerAddress || typeof ownerAddress !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(ownerAddress)) {
    return res.status(400).json({ error: 'Invalid ownerAddress' });
  }
  if (!tier || !TIERS[tier]) {
    return res.status(400).json({ error: 'Invalid tier (1, 2, or 3)' });
  }
  if (!characterId || typeof characterId !== 'string') {
    return res.status(400).json({ error: 'Invalid characterId' });
  }

  const tierConfig = TIERS[tier];
  const baseUrl = getBaseUrl(req);

  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Gold — ${tierConfig.label}`,
              description: 'In-game Gold for Ultimate Dominion',
            },
            unit_amount: tierConfig.cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        ownerAddress,
        characterId,
        tier,
        ethAmount: tierConfig.ethAmount,
      },
      success_url: `${baseUrl}?gold_purchase=success`,
      cancel_url: `${baseUrl}?gold_purchase=cancelled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('[stripe/session] Error creating checkout session:', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
