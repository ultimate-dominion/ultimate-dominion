import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { setupRoutes } from './api/index.js';
// Load environment variables based on NODE_ENV
const environment = process.env.NODE_ENV || 'development';
config({ path: `.env.${environment}` });
const app = express();
const port = process.env.PORT || 8080;
// CORS - restrict to allowed origins
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({ origin: allowedOrigins }));
// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);
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
