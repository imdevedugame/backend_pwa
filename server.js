import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load .env relative to backend directory explicitly to avoid CWD issues
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });

// Basic debug once at startup (do not log sensitive service role key)
const debugEnv = {
  PORT: process.env.PORT,
  SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
};
console.log('[ENV] Loaded:', debugEnv);

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Pastikan uploads folder ada
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Disable caching for API responses (menghindari cache agresif Safari)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Import Routes
import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';
import usersRouter from './routes/users.js';
import categoriesRouter from './routes/categories.js';
import ordersRouter from './routes/orders.js';
import cartRouter from './routes/cart.js';
import uploadRouter from './routes/upload.js';

// Routes
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/users', usersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/cart', cartRouter);
app.use('/api/upload', uploadRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API is running' });
});

// Home route
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend running. Use /api/* endpoints.',
    available: ['/api/health','/api/products','/api/auth/login','/api/auth/register']
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: err.message || 'Internal server error' 
  });
});

const BASE_PORT = parseInt(process.env.PORT, 10) || 5000;

function startServer(port, attempts = 0) {
  const server = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log('\nAvailable endpoints:');
    console.log('  Auth: POST /api/auth/register, POST /api/auth/login');
    console.log('  Products: GET /api/products, POST /api/products');
    console.log('  Users: GET /api/users/:id, PUT /api/users/:id');
    console.log('  Categories: GET /api/categories');
    console.log('  Orders: GET /api/orders, POST /api/orders');
    console.log('  Cart: GET /api/cart, POST /api/cart');
    console.log('  Upload: POST /api/upload');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempts < 5) {
      const nextPort = port + 1;
      console.warn(`Port ${port} in use, retrying on ${nextPort}...`);
      startServer(nextPort, attempts + 1);
    } else {
      console.error('Server failed to start:', err);
      process.exit(1);
    }
  });
}

startServer(BASE_PORT);
