import { Router } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const rondasRouter = Router();

// GET /api/rondas - Listar rondas con filtros
rondasRouter.get('/', async (req, res, next) => {
  try {
    const {
      turno_id,
      vigilante_id,
      ruta_id,
      estatus,
      fecha_inicio,
      fecha_fin,
      limit = '50',
      offset = '0'
    } = req.query;

    let query = supabase
      .from('rondas')
      .select(`
        *,
        vigilante:vigilantes(id, nombre),
        ruta:rutas(id, nombre),
        turno:turnos(id, inicio, fin)
      `, { count: 'exact' })
      .order('inicio', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (turno_id) {
      query = query.eq('turno_id', turno_id);
    }

    if (vigilante_id) {
      query = query.eq('vigilante_id', vigilante_id);
    }

    if (ruta_id) {
      query = query.eq('ruta_id', ruta_id);
    }

    if (estatus) {
      query = query.eq('estatus', estatus);
    }

    if (fecha_inicio) {
      query = query.gte('inicio', `${fecha_inicio}T00:00:00`);
    }

    if (fecha_fin) {
      query = query.lte('inicio', `${fecha_fin}T23:59:59.999Z`);
    }

    const { data, error, count } = await query;

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    res.json({
      success: true,
      data,
      pagination: {
        total: count,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/rondas/:id - Obtener ronda con detalles
rondasRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: ronda, error } = await supabase
      .from('rondas')
      .select(`
        *,
        vigilante:vigilantes(*),
        ruta:rutas(*),
        turno:turnos(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Ronda no encontrada', 404);
      }
      throw new AppError(error.message, 500, 'DB_ERROR');
    }

    // Obtener detalles con estaciones
    const { data: detalles } = await supabase
      .from('ronda_detalle')
      .select(`
        *,
        estacion:estaciones(*)
      `)
      .eq('ronda_id', id)
      .order('orden');

    res.json({
      success: true,
      data: {
        ...ronda,
        detalles
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/rondas/turno/:turnoId - Obtener todas las rondas de un turno
rondasRouter.get('/turno/:turnoId', async (req, res, next) => {
  try {
    const { turnoId } = req.params;

    const { data, error } = await supabase
      .from('rondas')
      .select(`
        *,
        ronda_detalle(
          *,
          estacion:estaciones(nombre, tag, orden)
        )
      `)
      .eq('turno_id', turnoId)
      .order('ventana_inicio');

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    // Ordenar detalles por orden
    const rondasOrdenadas = data?.map(ronda => ({
      ...ronda,
      ronda_detalle: ronda.ronda_detalle?.sort((a: any, b: any) => a.orden - b.orden)
    }));

    res.json({ success: true, data: rondasOrdenadas });
  } catch (error) {
    next(error);
  }
});

// POST /api/rondas/:id/recalcular - Recalcular estatus de una ronda
rondasRouter.post('/:id/recalcular', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Obtener ronda con detalles
    const { data: ronda, error } = await supabase
      .from('rondas')
      .select(`
        *,
        ruta:rutas(
          estaciones(*)
        ),
        ronda_detalle(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Ronda no encontrada', 404);
      }
      throw new AppError(error.message, 500, 'DB_ERROR');
    }

    // Recalcular estatus basado en las reglas de negocio
    const detalles = ronda.ronda_detalle || [];
    const estaciones = ronda.ruta.estaciones.sort((a: any, b: any) => a.orden - b.orden);

    let nuevoEstatus = 'COMPLETA';

    // Si no hay detalles, no realizada
    if (detalles.length === 0) {
      nuevoEstatus = 'NO_REALIZADA';
    } else {
      const detallesOrdenados = detalles.sort((a: any, b: any) => a.orden - b.orden);

      // Verificar que inicia en E1
      const primerDetalle = detallesOrdenados[0];
      if (primerDetalle.orden !== 1 || primerDetalle.estatus === 'OMITIDO') {
        nuevoEstatus = 'INVALIDA';
      }
      // Verificar que termina en E1
      else if (detallesOrdenados.length < estaciones.length) {
        nuevoEstatus = 'INCOMPLETA';
      }
      // Verificar si hay omitidos o retrasados
      else {
        const tieneOmitidos = detalles.some((d: any) => d.estatus === 'OMITIDO');
        const tieneRetrasados = detalles.some((d: any) => d.estatus === 'RETRASADO');

        if (tieneOmitidos) {
          nuevoEstatus = 'INCOMPLETA';
        } else if (tieneRetrasados) {
          nuevoEstatus = 'INCOMPLETA';
        }
      }
    }

    // Actualizar estatus
    const { data: rondaActualizada, error: updateError } = await supabase
      .from('rondas')
      .update({
        estatus: nuevoEstatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw new AppError(updateError.message, 500, 'DB_ERROR');

    res.json({
      success: true,
      data: rondaActualizada,
      message: `Estatus recalculado: ${nuevoEstatus}`
    });
  } catch (error) {
    next(error);
  }
});
