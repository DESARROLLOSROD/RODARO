import { Router } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { authMiddleware, agentAuthMiddleware } from '../middleware/auth';
import { procesarEventos } from '../services/motorRondas';
import { z } from 'zod';

export const eventosRouter = Router();

const eventoCrudoSchema = z.object({
  tag: z.string().min(1),
  fecha_hora: z.string().datetime(),
  lector_id: z.string().optional(),
  datos_crudos: z.string().optional()
});

const descargaSchema = z.object({
  lector_id: z.string(),
  eventos: z.array(eventoCrudoSchema),
  timestamp_descarga: z.string().datetime()
});

// POST /api/eventos/descarga - Recibir descarga (Agente o Web)
eventosRouter.post('/descarga', async (req, res, next) => {
  // Intentar autenticación por agente primero, luego por usuario
  const agentToken = req.headers['x-agent-token'];
  if (agentToken) {
    return agentAuthMiddleware(req, res, next);
  }
  return authMiddleware(req, res, next);
}, async (req, res, next) => {
  try {
    const validacion = descargaSchema.safeParse(req.body);

    if (!validacion.success) {
      throw new AppError(validacion.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    const { lector_id, eventos, timestamp_descarga } = validacion.data;

    if (eventos.length === 0) {
      return res.json({
        success: true,
        message: 'No hay eventos para procesar',
        procesados: 0
      });
    }

    // Normalizar y Deduplicar el lote actual en memoria
    const mapaEventos = new Map<string, any>();
    for (const e of eventos) {
      const tagNorm = e.tag.toUpperCase().replace(/\s/g, '');
      const key = `${tagNorm}_${e.fecha_hora}`;
      if (!mapaEventos.has(key)) {
        mapaEventos.set(key, {
          tag: tagNorm,
          fecha_hora: e.fecha_hora,
          lector_id: e.lector_id || lector_id,
          datos_crudos: e.datos_crudos,
          procesado: false
        });
      }
    }

    const eventosParaInsertar = Array.from(mapaEventos.values());

    // Insertar eventos ignorando duplicados existentes en la DB
    const { data: eventosInsertados, error } = await supabase
      .from('eventos')
      .insert(eventosParaInsertar)
      .select();

    // Nota: Si todos eran duplicados, eventosInsertados será [] o null, pero no habrá error de constraint
    if (error) {
      // Si falla por el constraint único a pesar de la lógica (ej: concurrencia extrema), lo manejamos
      if (error.code === '23505') {
        return res.json({
          success: true,
          message: 'Los eventos ya existen en el sistema',
          procesados: 0,
          duplicados: eventos.length
        });
      }
      throw new AppError(error.message, 500, 'DB_ERROR');
    }

    const nuevosCount = eventosInsertados?.length || 0;
    const duplicadosCount = eventos.length - nuevosCount;

    // Registrar log de descarga
    await supabase.from('logs_descarga').insert({
      lector_id,
      timestamp_descarga,
      eventos_recibidos: eventos.length,
      eventos_nuevos: nuevosCount,
      eventos_duplicados: duplicadosCount
    });

    // Procesar eventos para crear/actualizar rondas
    const resultadoProcesamiento = await procesarEventos(eventosInsertados || []);

    res.json({
      success: true,
      message: 'Descarga procesada correctamente',
      procesados: nuevosCount,
      duplicados: duplicadosCount,
      rondas_afectadas: resultadoProcesamiento.rondasAfectadas
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/eventos - Listar eventos (para debug/admin)
eventosRouter.get('/', async (req, res, next) => {
  try {
    const { procesado, fecha_inicio, fecha_fin, tag, limit = '100' } = req.query;

    let query = supabase
      .from('eventos')
      .select('*')
      .order('fecha_hora', { ascending: false })
      .limit(parseInt(limit as string));

    if (procesado !== undefined) {
      query = query.eq('procesado', procesado === 'true');
    }

    if (fecha_inicio) {
      query = query.gte('fecha_hora', fecha_inicio);
    }

    if (fecha_fin) {
      query = query.lte('fecha_hora', fecha_fin);
    }

    if (tag) {
      query = query.eq('tag', (tag as string).toUpperCase());
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// POST /api/eventos/reprocesar - Reprocesar eventos no procesados
eventosRouter.post('/reprocesar', agentAuthMiddleware, async (req, res, next) => {
  try {
    const { data: eventosNoProcesados, error } = await supabase
      .from('eventos')
      .select('*')
      .eq('procesado', false)
      .order('fecha_hora')
      .limit(500);

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    if (!eventosNoProcesados || eventosNoProcesados.length === 0) {
      return res.json({
        success: true,
        message: 'No hay eventos pendientes de procesar',
        procesados: 0
      });
    }

    const resultado = await procesarEventos(eventosNoProcesados);

    res.json({
      success: true,
      message: 'Reprocesamiento completado',
      procesados: eventosNoProcesados.length,
      rondas_afectadas: resultado.rondasAfectadas
    });
  } catch (error) {
    next(error);
  }
});
