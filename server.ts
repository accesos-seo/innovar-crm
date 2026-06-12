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

    // Escuchar en '::' (dual-stack IPv6+IPv4). Antes era '0.0.0.0' (solo IPv4):
    // si otro proceso (p.ej. `vite preview --port 3000`) tomaba [::1]:3000, el
    // navegador resolvía localhost→::1 y las llamadas /api caían en el proceso
    // equivocado (404/index.html) — subtotales en $0 sin error visible.
    const httpServer = app.listen(PORT, '::', () => {
      console.log(`🚀 INNOVAR ERP Server running at http://localhost:${PORT}`);
      console.log(`Backend Pricing Engine initialized.`);
    });
    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Puerto ${PORT} ya está ocupado por otro proceso (¿un vite preview viejo?).`);
        console.error(`   Liberalo: netstat -ano | findstr :${PORT}  →  taskkill /PID <pid> /F`);
      }
      throw err;
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
