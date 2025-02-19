import { uploadMetadata } from './uploadMetadata.js';
export function setupRoutes(app) {
    // Register API routes
    app.post('/api/upload', uploadMetadata);
}
