import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectMongoDB } from './db/mongodb.js';
import { apiKeyAuth } from './middleware/auth.js';
import patientRoutes from './routes/patients.js';
import visitRoutes from './routes/visits.js';
import syncRoutes from './routes/sync.js';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
let initPromise: Promise<void> | null = null;

const ensureInitialized = async () => {
  if (!initPromise) {
    initPromise = connectMongoDB()
      .then(() => {
        console.log('✅ MongoDB connected');
      })
      .catch((error) => {
        initPromise = null;
        throw error;
      });
  }

  await initPromise;
};

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureInitialized();
    next();
  } catch (error) {
    next(error);
  }
});

// Routes
app.use('/api/patients', apiKeyAuth, patientRoutes);
app.use('/api/visits', apiKeyAuth, visitRoutes);
app.use('/api/sync', apiKeyAuth, syncRoutes);

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
  });
});

// Start server
const start = async () => {
  try {
    await ensureInitialized();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

if (!process.env.VERCEL) {
  start();
}

export default app;
