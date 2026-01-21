import { Router } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

export const turnosRouter = Router();

const crearTurnoSchema = z.object({
  vigilante_id: z.string().uuid(),
  ruta_id: z.string().uuid(),
  inicio: z.string().datetime(),
  fin: z.string().datetime()
});

// GET /api/turnos - Listar turnos
turnosRouter.get('/', async (req, res, next) => {
  try {
    const { vigilante_id, fecha_inicio, fecha_fin, limit = '50' } = req.query;

    let query = supabase
      .from('turnos')
      .select(`
        *,
        vigilante:vigilantes(*),
        ruta:rutas(*)
      `)
      .order('inicio', { ascending: false })
      .limit(parseInt(limit as string));

    if (vigilante_id) {
      query = query.eq('vigilante_id', vigilante_id);
    }

    if (fecha_inicio) {
      query = query.gte('inicio', fecha_inicio);
    }

    if (fecha_fin) {
      query = query.lte('fin', fecha_fin);
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// GET /api/turnos/:id - Obtener turno con rondas
turnosRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('turnos')
      .select(`
        *,
        vigilante:vigilantes(*),
        ruta:rutas(*,
          estaciones(*)
        ),
        rondas(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Turno no encontrado', 404);
      }
      throw new AppError(error.message, 500, 'DB_ERROR');
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// POST /api/turnos - Crear turno
turnosRouter.post('/', async (req, res, next) => {
  try {
    const validacion = crearTurnoSchema.safeParse(req.body);

    if (!validacion.success) {
      throw new AppError(validacion.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    const { vigilante_id, ruta_id, inicio, fin } = validacion.data;

    // Verificar que no hay turnos solapados para el vigilante
    const { data: turnosSolapados } = await supabase
      .from('turnos')
      .select('id')
      .eq('vigilante_id', vigilante_id)
      .or(`and(inicio.lte.${fin},fin.gte.${inicio})`);

    if (turnosSolapados && turnosSolapados.length > 0) {
      throw new AppError('El vigilante ya tiene un turno en este horario', 400, 'TURNO_SOLAPADO');
    }

    // Verificar que vigilante y ruta existen
    const [{ data: vigilante }, { data: ruta }] = await Promise.all([
      supabase.from('vigilantes').select('id').eq('id', vigilante_id).single(),
      supabase.from('rutas').select('id').eq('id', ruta_id).single()
    ]);

    if (!vigilante) {
      throw new AppError('Vigilante no encontrado', 404);
    }

    if (!ruta) {
      throw new AppError('Ruta no encontrada', 404);
    }

    const { data, error } = await supabase
      .from('turnos')
      .insert({
        vigilante_id,
        ruta_id,
        inicio,
        fin
      })
      .select(`
        *,
        vigilante:vigilantes(*),
        ruta:rutas(*)
      `)
      .single();

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// PUT /api/turnos/:id - Actualizar turno
turnosRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { vigilante_id, ruta_id, inicio, fin } = req.body;

    const { data, error } = await supabase
      .from('turnos')
      .update({
        vigilante_id,
        ruta_id,
        inicio,
        fin
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Turno no encontrado', 404);
      }
      throw new AppError(error.message, 500, 'DB_ERROR');
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/turnos/:id - Eliminar turno
turnosRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar si tiene rondas asociadas
    const { data: rondas } = await supabase
      .from('rondas')
      .select('id')
      .eq('turno_id', id)
      .limit(1);

    if (rondas && rondas.length > 0) {
      throw new AppError('No se puede eliminar un turno con rondas registradas', 400);
    }

    const { error } = await supabase
      .from('turnos')
      .delete()
      .eq('id', id);

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    res.json({ success: true, message: 'Turno eliminado' });
  } catch (error) {
    next(error);
  }
});

// GET /api/turnos/:id/resumen - Obtener resumen del turno
turnosRouter.get('/:id/resumen', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: turno, error } = await supabase
      .from('turnos')
      .select(`
        *,
        vigilante:vigilantes(*),
        ruta:rutas(frecuencia_min),
        rondas(estatus)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Turno no encontrado', 404);
      }
      throw new AppError(error.message, 500, 'DB_ERROR');
    }

    // Calcular estadísticas
    const rondas = turno.rondas || [];
    const duracionTurnoMin = (new Date(turno.fin).getTime() - new Date(turno.inicio).getTime()) / (1000 * 60);
    const rondasEsperadas = Math.floor(duracionTurnoMin / turno.ruta.frecuencia_min);

    const resumen = {
      turno_id: id,
      vigilante: turno.vigilante,
      inicio: turno.inicio,
      fin: turno.fin,
      total_rondas_esperadas: rondasEsperadas,
      rondas_completas: rondas.filter((r: any) => r.estatus === 'COMPLETA').length,
      rondas_incompletas: rondas.filter((r: any) => r.estatus === 'INCOMPLETA').length,
      rondas_invalidas: rondas.filter((r: any) => r.estatus === 'INVALIDA').length,
      rondas_no_realizadas: rondas.filter((r: any) => r.estatus === 'NO_REALIZADA').length,
      porcentaje_cumplimiento: 0
    };

    resumen.porcentaje_cumplimiento = rondasEsperadas > 0
      ? Math.round((resumen.rondas_completas / rondasEsperadas) * 100)
      : 0;

    res.json({ success: true, data: resumen });
  } catch (error) {
    next(error);
  }
});
