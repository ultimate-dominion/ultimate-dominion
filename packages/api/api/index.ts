import { Express } from 'express';
import { uploadMetadata } from './uploadMetadata.js';

export function setupRoutes(app: Express): void {
  // Register API routes
  app.post('/api/upload', uploadMetadata);
}
