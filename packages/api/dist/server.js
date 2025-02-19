import express from 'express';
import { config } from 'dotenv';
import { setupRoutes } from './api/index.js';
// Load environment variables based on NODE_ENV
const environment = process.env.NODE_ENV || 'development';
config({ path: `.env.${environment}` });
const app = express();
const port = process.env.PORT || 8080;
// CORS middleware
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
// Body parser middleware
app.use(express.json());
// Setup API routes
setupRoutes(app);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', environment });
});
app.listen(port, () => {
    console.log(`Server running on port ${port} in ${environment} mode`);
});
