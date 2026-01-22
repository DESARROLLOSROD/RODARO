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

// POST /api/rondas/recalcular-todas - Recalcular diferencias de TODAS las rondas (migración)
rondasRouter.post('/recalcular-todas', async (req, res, next) => {
  try {
    console.log('=== RECALCULANDO TODAS LAS RONDAS ===');

    // Obtener todas las rondas
    const { data: rondas, error: errorRondas } = await supabase
      .from('rondas')
      .select('id, inicio, estatus, ruta_id')
      .order('created_at', { ascending: false });

    if (errorRondas) throw new AppError(errorRondas.message, 500, 'DB_ERROR');

    let rondasCorregidas = 0;
    let detallesCorregidos = 0;

    for (const ronda of rondas || []) {
      // Obtener detalles de la ronda con información de estaciones
      const { data: detalles, error: errorDetalles } = await supabase
        .from('ronda_detalle')
        .select(`
          id,
          orden,
          fecha_hora,
          diferencia_seg,
          estatus,
          estacion:estaciones(
            id,
            tiempo_esperado_seg,
            tolerancia_seg
          )
        `)
        .eq('ronda_id', ronda.id)
        .order('orden', { ascending: true });

      if (errorDetalles || !detalles || detalles.length === 0) continue;

      let rondaModificada = false;
      let tieneRetrasados = false;

      for (let i = 0; i < detalles.length; i++) {
        const detalle = detalles[i] as any;
        if (!detalle.fecha_hora || !detalle.estacion) continue;

        let nuevaDiferencia: number;

        if (i === 0) {
          // Primera estación: diferencia es 0 (punto de partida)
          nuevaDiferencia = 0;
        } else {
          // Estaciones intermedias: calcular intervalo punto a punto
          const detalleAnterior = detalles[i - 1] as any;

          if (detalleAnterior.fecha_hora && detalleAnterior.estacion) {
            const fechaAnterior = new Date(detalleAnterior.fecha_hora);
            const fechaActual = new Date(detalle.fecha_hora);
            const tiempoReal = Math.round((fechaActual.getTime() - fechaAnterior.getTime()) / 1000);

            // Calcular intervalo esperado (diferencia entre tiempos acumulados)
            const tiempoEsperadoAnterior = detalleAnterior.estacion.tiempo_esperado_seg || 0;
            const tiempoEsperadoActual = detalle.estacion.tiempo_esperado_seg || 0;
            const intervaloEsperado = tiempoEsperadoActual - tiempoEsperadoAnterior;

            nuevaDiferencia = tiempoReal - intervaloEsperado;
          } else {
            nuevaDiferencia = detalle.diferencia_seg || 0;
          }
        }

        // Determinar nuevo estatus
        const tolerancia = detalle.estacion.tolerancia_seg || 300;
        const nuevoEstatus = Math.abs(nuevaDiferencia) > tolerancia ? 'RETRASADO' : 'A_TIEMPO';

        if (nuevoEstatus === 'RETRASADO') tieneRetrasados = true;

        // Solo actualizar si hay cambios
        if (detalle.diferencia_seg !== nuevaDiferencia || detalle.estatus !== nuevoEstatus) {
          await supabase
            .from('ronda_detalle')
            .update({ diferencia_seg: nuevaDiferencia, estatus: nuevoEstatus })
            .eq('id', detalle.id);

          detallesCorregidos++;
          rondaModificada = true;
        }
      }

      // Actualizar estatus de la ronda si es necesario
      if (rondaModificada) {
        rondasCorregidas++;

        const { data: estaciones } = await supabase
          .from('estaciones')
          .select('id')
          .eq('ruta_id', ronda.ruta_id)
          .eq('activa', true);

        const totalEstaciones = estaciones?.length || 0;

        let nuevoEstatusRonda = ronda.estatus;
        if (ronda.estatus === 'INCOMPLETA' && !tieneRetrasados && detalles.length >= totalEstaciones) {
          nuevoEstatusRonda = 'COMPLETA';
        } else if (tieneRetrasados && ronda.estatus === 'COMPLETA') {
          nuevoEstatusRonda = 'INCOMPLETA';
        }

        if (nuevoEstatusRonda !== ronda.estatus) {
          await supabase
            .from('rondas')
            .update({ estatus: nuevoEstatusRonda })
            .eq('id', ronda.id);
        }
      }
    }

    res.json({
      success: true,
      message: `Recálculo completado: ${rondasCorregidas} rondas, ${detallesCorregidos} detalles corregidos`
    });
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
