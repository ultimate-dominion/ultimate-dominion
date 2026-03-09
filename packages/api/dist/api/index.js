import uploadMetadata from './uploadMetadata.js';
import sessionBooting from './sessionBooting.js';
import uploadFile from './uploadFile.js';
import errors from './errors.js';
import metrics from './metrics.js';
// Create Express-compatible wrappers for Vercel handlers
const wrapVercelHandler = (handler) => async (req, res) => {
    return handler(req, res);
};
export function setupRoutes(app) {
    // Register API routes with Express-compatible wrappers
    app.post('/api/upload', wrapVercelHandler(uploadMetadata)); // Upload character metadata to IPFS
    app.post('/api/upload-file', wrapVercelHandler(uploadFile)); // Upload and process image files
    app.get('/api/session', wrapVercelHandler(sessionBooting)); // Game session management
    app.post('/api/errors', wrapVercelHandler(errors)); // Client error reporting
    app.post('/api/metrics', wrapVercelHandler(metrics)); // Client performance metrics
}
