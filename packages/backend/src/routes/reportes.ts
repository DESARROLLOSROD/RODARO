import { Router } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const reportesRouter = Router();

// GET /api/reportes/diario - Reporte diario
reportesRouter.get('/diario', async (req, res, next) => {
  try {
    const { fecha } = req.query;

    if (!fecha) {
      throw new AppError('Se requiere el parámetro fecha (YYYY-MM-DD)', 400);
    }

    const fechaInicio = `${fecha}T00:00:00.000Z`;
    const fechaFin = `${fecha}T23:59:59.999Z`;

    // Obtener turnos del día
    const { data: turnos, error } = await supabase
      .from('turnos')
      .select(`
        *,
        vigilante:vigilantes(id, nombre),
        ruta:rutas(id, nombre, frecuencia_min),
        rondas(estatus)
      `)
      .or(`and(inicio.lte.${fechaFin},fin.gte.${fechaInicio})`);

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    const resumenTurnos = turnos?.map(turno => {
      const rondas = turno.rondas || [];
      const duracionMin = (new Date(turno.fin).getTime() - new Date(turno.inicio).getTime()) / (1000 * 60);
      const rondasEsperadas = Math.floor(duracionMin / turno.ruta.frecuencia_min);

      const completas = rondas.filter((r: any) => r.estatus === 'COMPLETA').length;
      const incompletas = rondas.filter((r: any) => r.estatus === 'INCOMPLETA').length;
      const invalidas = rondas.filter((r: any) => r.estatus === 'INVALIDA').length;
      const noRealizadas = rondas.filter((r: any) => r.estatus === 'NO_REALIZADA').length;

      return {
        turno_id: turno.id,
        vigilante: turno.vigilante,
        ruta: turno.ruta,
        inicio: turno.inicio,
        fin: turno.fin,
        rondas_esperadas: rondasEsperadas,
        rondas_completas: completas,
        rondas_incompletas: incompletas,
        rondas_invalidas: invalidas,
        rondas_no_realizadas: noRealizadas,
        cumplimiento: rondasEsperadas > 0 ? Math.round((completas / rondasEsperadas) * 100) : 0
      };
    });

    const totalRondas = resumenTurnos?.reduce((acc, t) => acc + t.rondas_esperadas, 0) || 0;
    const totalCompletas = resumenTurnos?.reduce((acc, t) => acc + t.rondas_completas, 0) || 0;

    res.json({
      success: true,
      data: {
        fecha,
        turnos: resumenTurnos,
        resumen: {
          total_turnos: turnos?.length || 0,
          total_rondas_esperadas: totalRondas,
          total_rondas_completas: totalCompletas,
          cumplimiento_general: totalRondas > 0 ? Math.round((totalCompletas / totalRondas) * 100) : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reportes/vigilante/:id - Reporte por vigilante
reportesRouter.get('/vigilante/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      throw new AppError('Se requieren fecha_inicio y fecha_fin', 400);
    }

    const { data: vigilante, error: vigilanteError } = await supabase
      .from('vigilantes')
      .select('*')
      .eq('id', id)
      .single();

    if (vigilanteError) {
      if (vigilanteError.code === 'PGRST116') {
        throw new AppError('Vigilante no encontrado', 404);
      }
      throw new AppError(vigilanteError.message, 500);
    }

    const { data: turnos, error } = await supabase
      .from('turnos')
      .select(`
        *,
        ruta:rutas(id, nombre, frecuencia_min),
        rondas(
          id,
          estatus,
          inicio,
          fin,
          ventana_inicio,
          ventana_fin
        )
      `)
      .eq('vigilante_id', id)
      .gte('inicio', fecha_inicio)
      .lte('fin', fecha_fin)
      .order('inicio', { ascending: false });

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    // Calcular estadísticas
    let totalEsperadas = 0;
    let totalCompletas = 0;
    let totalIncompletas = 0;
    let totalInvalidas = 0;
    let totalNoRealizadas = 0;

    const turnosConEstadisticas = turnos?.map(turno => {
      const rondas = turno.rondas || [];
      const duracionMin = (new Date(turno.fin).getTime() - new Date(turno.inicio).getTime()) / (1000 * 60);
      const esperadas = Math.floor(duracionMin / turno.ruta.frecuencia_min);

      const completas = rondas.filter((r: any) => r.estatus === 'COMPLETA').length;
      const incompletas = rondas.filter((r: any) => r.estatus === 'INCOMPLETA').length;
      const invalidas = rondas.filter((r: any) => r.estatus === 'INVALIDA').length;
      const noRealizadas = rondas.filter((r: any) => r.estatus === 'NO_REALIZADA').length;

      totalEsperadas += esperadas;
      totalCompletas += completas;
      totalIncompletas += incompletas;
      totalInvalidas += invalidas;
      totalNoRealizadas += noRealizadas;

      return {
        ...turno,
        estadisticas: {
          esperadas,
          completas,
          incompletas,
          invalidas,
          no_realizadas: noRealizadas,
          cumplimiento: esperadas > 0 ? Math.round((completas / esperadas) * 100) : 0
        }
      };
    });

    res.json({
      success: true,
      data: {
        vigilante,
        periodo: { fecha_inicio, fecha_fin },
        turnos: turnosConEstadisticas,
        resumen: {
          total_turnos: turnos?.length || 0,
          total_rondas_esperadas: totalEsperadas,
          total_rondas_completas: totalCompletas,
          total_rondas_incompletas: totalIncompletas,
          total_rondas_invalidas: totalInvalidas,
          total_rondas_no_realizadas: totalNoRealizadas,
          cumplimiento_general: totalEsperadas > 0 ? Math.round((totalCompletas / totalEsperadas) * 100) : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reportes/ruta/:id - Reporte por ruta
reportesRouter.get('/ruta/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      throw new AppError('Se requieren fecha_inicio y fecha_fin', 400);
    }

    const { data: ruta, error: rutaError } = await supabase
      .from('rutas')
      .select(`
        *,
        estaciones(*)
      `)
      .eq('id', id)
      .single();

    if (rutaError) {
      if (rutaError.code === 'PGRST116') {
        throw new AppError('Ruta no encontrada', 404);
      }
      throw new AppError(rutaError.message, 500);
    }

    // Obtener estadísticas por estación
    const { data: detalles, error: detallesError } = await supabase
      .from('ronda_detalle')
      .select(`
        *,
        estacion:estaciones(id, nombre, orden),
        ronda:rondas!inner(
          id,
          ruta_id,
          inicio
        )
      `)
      .eq('ronda.ruta_id', id)
      .gte('ronda.inicio', fecha_inicio)
      .lte('ronda.inicio', fecha_fin);

    if (detallesError) throw new AppError(detallesError.message, 500);

    // Agrupar por estación
    const estadisticasPorEstacion: Record<string, any> = {};

    ruta.estaciones.forEach((estacion: any) => {
      estadisticasPorEstacion[estacion.id] = {
        estacion: {
          id: estacion.id,
          nombre: estacion.nombre,
          orden: estacion.orden
        },
        total_registros: 0,
        a_tiempo: 0,
        retrasados: 0,
        omitidos: 0,
        promedio_diferencia_seg: 0,
        diferencias: []
      };
    });

    detalles?.forEach((detalle: any) => {
      const stats = estadisticasPorEstacion[detalle.estacion_id];
      if (stats) {
        stats.total_registros++;
        if (detalle.estatus === 'A_TIEMPO') stats.a_tiempo++;
        else if (detalle.estatus === 'RETRASADO') stats.retrasados++;
        else if (detalle.estatus === 'OMITIDO') stats.omitidos++;

        if (detalle.diferencia_seg !== null) {
          stats.diferencias.push(detalle.diferencia_seg);
        }
      }
    });

    // Calcular promedios
    Object.values(estadisticasPorEstacion).forEach((stats: any) => {
      if (stats.diferencias.length > 0) {
        stats.promedio_diferencia_seg = Math.round(
          stats.diferencias.reduce((a: number, b: number) => a + b, 0) / stats.diferencias.length
        );
      }
      delete stats.diferencias;
    });

    res.json({
      success: true,
      data: {
        ruta: {
          id: ruta.id,
          nombre: ruta.nombre,
          frecuencia_min: ruta.frecuencia_min
        },
        periodo: { fecha_inicio, fecha_fin },
        estadisticas_por_estacion: Object.values(estadisticasPorEstacion).sort(
          (a: any, b: any) => a.estacion.orden - b.estacion.orden
        )
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reportes/no-realizadas - Rondas no realizadas
reportesRouter.get('/no-realizadas', async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin, vigilante_id, ruta_id } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      throw new AppError('Se requieren fecha_inicio y fecha_fin', 400);
    }

    let query = supabase
      .from('rondas')
      .select(`
        *,
        vigilante:vigilantes(id, nombre),
        ruta:rutas(id, nombre),
        turno:turnos(id, inicio, fin)
      `)
      .eq('estatus', 'NO_REALIZADA')
      .gte('ventana_inicio', fecha_inicio)
      .lte('ventana_inicio', fecha_fin)
      .order('ventana_inicio', { ascending: false });

    if (vigilante_id) {
      query = query.eq('vigilante_id', vigilante_id);
    }

    if (ruta_id) {
      query = query.eq('ruta_id', ruta_id);
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    res.json({
      success: true,
      data,
      total: data?.length || 0
    });
  } catch (error) {
    next(error);
  }
});
