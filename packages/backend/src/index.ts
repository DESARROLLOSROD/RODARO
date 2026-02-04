import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { vigilantesRouter } from './routes/vigilantes';
import { rutasRouter } from './routes/rutas';
import { turnosRouter } from './routes/turnos';
import { rondasRouter } from './routes/rondas';
import { eventosRouter } from './routes/eventos';
import { reportesRouter } from './routes/reportes';
import { festivosRouter } from './routes/festivos';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de seguridad
app.use(helmet());

// CORS - permitir múltiples orígenes
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (como mobile apps o curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.some(allowed => origin.startsWith(allowed!))) {
      callback(null, true);
    } else {
      console.log(`CORS bloqueado para origen: ${origin}`);
      callback(null, true); // Temporalmente permitir todos para debug
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // máximo 100 requests por ventana
});
app.use(limiter);

// Parsing
app.use(express.json({ limit: '10mb' }));

// Health check (sin auth)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rutas de la API
app.use('/api/vigilantes', authMiddleware, vigilantesRouter);
app.use('/api/rutas', authMiddleware, rutasRouter);
app.use('/api/turnos', authMiddleware, turnosRouter);
app.use('/api/rondas', authMiddleware, rondasRouter);
app.use('/api/eventos', eventosRouter); // Auth especial para agente
app.use('/api/reportes', authMiddleware, reportesRouter);
app.use('/api/festivos', authMiddleware, festivosRouter);

// Manejador de errores
app.use(errorHandler);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend API corriendo en puerto ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
