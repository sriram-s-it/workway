import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { ENV } from './backend/config/env.js';
import { initDatabase, db } from './backend/database/index.js';
import { initSocketIO } from './backend/services/socketService.js';
import { startAssignmentTimeoutJob } from './backend/services/assignmentTimeoutService.js';
import { errorHandler } from './backend/middleware/errorHandler.js';

// Route imports
import authRoutes from './backend/routes/authRoutes.js';
import departmentRoutes from './backend/routes/departmentRoutes.js';
import serviceRoutes from './backend/routes/serviceRoutes.js';
import bookingRoutes from './backend/routes/bookingRoutes.js';
import headRoutes from './backend/routes/headRoutes.js';
import workerRoutes from './backend/routes/workerRoutes.js';
import paymentRoutes from './backend/routes/paymentRoutes.js';
import feedbackRoutes from './backend/routes/feedbackRoutes.js';
import notificationRoutes from './backend/routes/notificationRoutes.js';
import adminRoutes from './backend/routes/adminRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Initialize DB and Socket.IO
  await initDatabase();
  initSocketIO(server);
  startAssignmentTimeoutJob();

  // Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // System Health API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'UP',
      service: 'WORKWAY API',
      timestamp: new Date().toISOString(),
      database: db.getStatus(),
      node_env: ENV.NODE_ENV,
    });
  });

  // Mount API modules
  app.use('/api/auth', authRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/services', serviceRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/head', headRoutes);
  app.use('/api/worker', workerRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);

  // Error handling middleware
  app.use(errorHandler);

  // Frontend Serving: Vite in Dev, Static in Prod
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[WORKWAY] Server actively running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[WORKWAY Startup Fatal Error]', err);
  process.exit(1);
});
