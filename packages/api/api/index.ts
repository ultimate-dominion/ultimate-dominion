import { Express, Request, Response } from 'express';
import uploadMetadata from './uploadMetadata.js';
import sessionBooting from './sessionBooting.js';
import sessionLite from './session_lite.js';
import uploadFile from './uploadFile.js';
import errors from './errors.js';
import metrics from './metrics.js';

// Create Express-compatible wrappers for Vercel handlers
const wrapVercelHandler = (handler: (req: Request, res: Response) => Promise<void | unknown> | void | unknown) => async (req: Request, res: Response) => {
  return handler(req, res);
};

export function setupRoutes(app: Express): void {
  // Register API routes with Express-compatible wrappers
  app.post('/api/upload', wrapVercelHandler(uploadMetadata));       // Upload character metadata to IPFS
  app.post('/api/upload-file', wrapVercelHandler(uploadFile));      // Upload and process image files
  app.get('/api/session', wrapVercelHandler(sessionBooting));       // Game session management
  app.get('/api/session_lite', wrapVercelHandler(sessionLite));     // Lightweight session endpoint (faster)
  app.post('/api/errors', wrapVercelHandler(errors));               // Client error reporting
  app.post('/api/metrics', wrapVercelHandler(metrics));             // Client performance metrics
}
