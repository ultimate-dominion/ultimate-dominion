import { Express } from 'express';
import { uploadMetadata } from './uploadMetadata.js';
import sessionBooting from './sessionBooting.js';
import uploadFile from './uploadFile.js';

export function setupRoutes(app: Express): void {
  // Register API routes
  app.post('/api/upload', uploadMetadata);  // Upload character metadata to IPFS
  app.post('/api/upload-file', uploadFile); // Upload and process image files
  app.get('/api/session', sessionBooting);  // Game session management
}
