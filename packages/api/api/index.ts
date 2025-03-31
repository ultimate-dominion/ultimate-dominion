import { Express, Request, Response } from 'express';
import uploadMetadata from './uploadMetadata.js';
import sessionBooting from './sessionBooting.js';
import uploadFile from './uploadFile.js';

// Create Express-compatible wrappers for Vercel handlers
const wrapVercelHandler = (handler: (req: Request, res: Response) => Promise<void | unknown> | void | unknown) => async (req: Request, res: Response) => {
  return handler(req, res);
};

export function setupRoutes(app: Express): void {
  // Register API routes with Express-compatible wrappers
  app.post('/api/upload', wrapVercelHandler(uploadMetadata));       // Upload character metadata to IPFS
  app.post('/api/upload-file', wrapVercelHandler(uploadFile));      // Upload and process image files
  app.get('/api/session', wrapVercelHandler(sessionBooting));       // Game session management
}
