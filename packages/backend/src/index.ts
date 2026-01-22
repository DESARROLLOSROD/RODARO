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

// Ruta temporal para migración de rondas (sin auth - ELIMINAR después de usar)
import { supabase } from './config/supabase';
app.post('/api/admin/recalcular-rondas', async (req, res) => {
  try {
    console.log('=== RECALCULANDO TODAS LAS RONDAS ===');
    const { data: rondas } = await supabase.from('rondas').select('id, inicio, estatus, ruta_id');

    let rondasCorregidas = 0, detallesCorregidos = 0;

    for (const ronda of rondas || []) {
      const { data: detalles } = await supabase
        .from('ronda_detalle')
        .select('id, orden, fecha_hora, diferencia_seg, estatus, estacion:estaciones(id, tiempo_esperado_seg, tolerancia_seg)')
        .eq('ronda_id', ronda.id)
        .order('orden', { ascending: true });

      if (!detalles || detalles.length === 0) continue;

      let rondaModificada = false, tieneRetrasados = false;

      for (let i = 0; i < detalles.length; i++) {
        const detalle = detalles[i] as any;
        if (!detalle.fecha_hora || !detalle.estacion) continue;

        let nuevaDiferencia: number;
        if (i === 0) {
          nuevaDiferencia = 0;
        } else {
          const detalleAnterior = detalles[i - 1] as any;
          if (detalleAnterior.fecha_hora && detalleAnterior.estacion) {
            const tiempoReal = Math.round((new Date(detalle.fecha_hora).getTime() - new Date(detalleAnterior.fecha_hora).getTime()) / 1000);
            const intervaloEsperado = (detalle.estacion.tiempo_esperado_seg || 0) - (detalleAnterior.estacion.tiempo_esperado_seg || 0);
            nuevaDiferencia = tiempoReal - intervaloEsperado;
          } else {
            nuevaDiferencia = detalle.diferencia_seg || 0;
          }
        }

        const tolerancia = detalle.estacion.tolerancia_seg || 300;
        const nuevoEstatus = Math.abs(nuevaDiferencia) > tolerancia ? 'RETRASADO' : 'A_TIEMPO';
        if (nuevoEstatus === 'RETRASADO') tieneRetrasados = true;

        if (detalle.diferencia_seg !== nuevaDiferencia || detalle.estatus !== nuevoEstatus) {
          await supabase.from('ronda_detalle').update({ diferencia_seg: nuevaDiferencia, estatus: nuevoEstatus }).eq('id', detalle.id);
          detallesCorregidos++;
          rondaModificada = true;
        }
      }

      if (rondaModificada) {
        rondasCorregidas++;
        const { data: estaciones } = await supabase.from('estaciones').select('id').eq('ruta_id', ronda.ruta_id).eq('activa', true);
        let nuevoEstatusRonda = ronda.estatus;
        if (ronda.estatus === 'INCOMPLETA' && !tieneRetrasados && detalles.length >= (estaciones?.length || 0)) {
          nuevoEstatusRonda = 'COMPLETA';
        }
        if (nuevoEstatusRonda !== ronda.estatus) {
          await supabase.from('rondas').update({ estatus: nuevoEstatusRonda }).eq('id', ronda.id);
        }
      }
    }

    res.json({ success: true, message: `Recálculo completado: ${rondasCorregidas} rondas, ${detallesCorregidos} detalles corregidos` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
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
