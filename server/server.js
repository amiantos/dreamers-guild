import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import requestsRouter from './routes/requests.js';
import imagesRouter from './routes/images.js';
import settingsRouter from './routes/settings.js';
import stylesRouter from './routes/styles.js';
import albumsRouter from './routes/albums.js';
import loraCacheRouter from './routes/loraCache.js';
import tiCacheRouter from './routes/tiCache.js';
import civitaiRouter from './routes/civitai.js';

// Import services
import queueManager from './services/queueManager.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8005;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/requests', requestsRouter);
app.use('/api/images', imagesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/styles', stylesRouter);
app.use('/api/albums', albumsRouter);
app.use('/api/lora-cache', loraCacheRouter);
app.use('/api/ti-cache', tiCacheRouter);
app.use('/api/civitai', civitaiRouter);

// Health check
app.get('/api/health', (req, res) => {
  const queueStatus = queueManager.getStatus();
  res.json({
    status: 'ok',
    queue: queueStatus,
    timestamp: new Date().toISOString()
  });
});

// Serve Vue client in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../vue_client/dist');
  app.use(express.static(clientPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Start queue manager
queueManager.start();

// Start server
app.listen(PORT, () => {
  console.log(`Aislingeach Web server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API Key configured: ${process.env.HORDE_API_KEY ? 'Yes' : 'No'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  queueManager.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  queueManager.stop();
  process.exit(0);
});
