import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ 
    message: "Test endpoint working",
    environment: process.env.NODE_ENV,
    // Check if environment variables exist but don't show their values for security
    envVars: {
      PINATA_JWT: !!process.env.PINATA_JWT,
      PRIVATE_KEY: !!process.env.PRIVATE_KEY,
      WORLD_ADDRESS: !!process.env.WORLD_ADDRESS,
      INITIAL_BLOCK_NUMBER: !!process.env.INITIAL_BLOCK_NUMBER
    }
  });
}
