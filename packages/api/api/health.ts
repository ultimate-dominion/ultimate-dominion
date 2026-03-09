import { VercelRequest, VercelResponse } from '@vercel/node';
import { setCors } from '../lib/cors.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (setCors(req, res, "GET, OPTIONS")) return res.status(204).end();
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}
