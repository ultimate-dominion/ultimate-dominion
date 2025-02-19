import { Express } from 'express';
import { uploadMetadata } from './uploadMetadata.js';
import sessionBooting from './sessionBooting.js';

export function setupRoutes(app: Express): void {
  // Register API routes
  app.post('/api/upload', uploadMetadata);
  app.get('/api/session', sessionBooting);
}
