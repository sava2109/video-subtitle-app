import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import videoRoutes from './routes/videoRoutes';
import subtitleRoutes from './routes/subtitleRoutes';
import { passwordAuth, loginHandler, logoutHandler, checkAuthHandler } from './middleware/auth';

// Глобални error handler-и да сервер не падне
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();

// Kreiranje foldera ako ne postoje
const uploadsDir = path.join(__dirname, '../uploads');
const exportsDir = path.join(__dirname, '../exports');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request логовање
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

// Auth routes (no password required)
app.post('/api/auth/login', loginHandler);
app.post('/api/auth/logout', logoutHandler);
app.get('/api/auth/check', checkAuthHandler);

// Health check (no password required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Сервер ради! 🚀' });
});

// Password protection for API and static files
app.use('/api', passwordAuth);
app.use('/uploads', passwordAuth);
app.use('/exports', passwordAuth);

// Static folders
app.use('/uploads', express.static(uploadsDir));
app.use('/exports', express.static(exportsDir));

// Routes
app.use('/api/videos', videoRoutes);
app.use('/api/subtitles', subtitleRoutes);

// Serve React frontend in production
const clientBuildPath = path.join(__dirname, '../client/build');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error', 
    message: err.message 
  });
});

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 Сервер покренут на http://localhost:${PORT}`);
  console.log(`📁 Uploads folder: ${uploadsDir}`);
  console.log(`📁 Exports folder: ${exportsDir}`);
});

export default app;