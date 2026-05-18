import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { calculateItemTotal, saveQuotation } from './server/controllers/quotation.controller';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  try {
    console.log('🏁 Starting INNOVAR ERP Server...');
    const app = express();
    const PORT = 3000;

    app.use(express.json());
    console.log('✅ Middleware initialized');

    // API Routes
    app.post('/api/quotations/calculate-item', calculateItemTotal);
    app.post('/api/quotations/save', saveQuotation);
    console.log('✅ API Routes registered');

    // Vite Middleware
    if (process.env.NODE_ENV !== 'production') {
      console.log('📦 Initializing Vite Development Engine...');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('✅ Vite Middleware attached');
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 INNOVAR ERP Server running at http://0.0.0.0:${PORT}`);
      console.log(`Backend Pricing Engine initialized.`);
    });
  } catch (error) {
    console.error('❌ CRITICAL: Server failed during initialization:', error);
    process.exit(1);
  }
}

startServer().catch(err => {
  console.error('❌ UNHANDLED ERROR in startServer:', err);
  process.exit(1);
});
