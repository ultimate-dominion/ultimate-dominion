import uploadMetadata from './uploadMetadata.js';
import sessionBooting from './sessionBooting.js';
import sessionLite from './session_lite.js';
import uploadFile from './uploadFile.js';
// Create Express-compatible wrappers for Vercel handlers
const wrapVercelHandler = (handler) => async (req, res) => {
    return handler(req, res);
};
export function setupRoutes(app) {
    // Register API routes with Express-compatible wrappers
    app.post('/api/upload', wrapVercelHandler(uploadMetadata)); // Upload character metadata to IPFS
    app.post('/api/upload-file', wrapVercelHandler(uploadFile)); // Upload and process image files
    app.get('/api/session', wrapVercelHandler(sessionBooting)); // Game session management
    app.get('/api/session_lite', wrapVercelHandler(sessionLite)); // Lightweight session endpoint (faster)
}
