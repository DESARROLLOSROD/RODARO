import { supabase } from '../config/supabase';

interface Evento {
  id: string;
  tag: string;
  fecha_hora: string;
  procesado: boolean;
}

interface Estacion {
  id: string;
  ruta_id: string;
  tag: string;
  orden: number;
  tiempo_esperado_seg: number;
  tolerancia_seg: number;
}

interface Turno {
  id: string;
  vigilante_id: string;
  ruta_id: string;
  inicio: string;
  fin: string;
}

interface ResultadoProcesamiento {
  rondasAfectadas: number;
  errores: string[];
}

/**
 * Motor de Rondas - Procesa eventos y genera/actualiza rondas
 *
 * Reglas de negocio:
 * - Ronda válida: E1 → E2 → ... → En → E1, cumple orden y tiempos
 * - Ronda incompleta: Falta estación o retardo fuera de tolerancia
 * - Ronda inválida: No inicia o no termina en E1
 * - Ronda no realizada: No existe E1 en ventana esperada
 */
export async function procesarEventos(eventos: Evento[]): Promise<ResultadoProcesamiento> {
  const resultado: ResultadoProcesamiento = {
    rondasAfectadas: 0,
    errores: []
  };

  if (eventos.length === 0) return resultado;

  try {
    // Agrupar eventos por TAG
    // IMPORTANTE: Ordenar eventos por fecha antes de agrupar para asegurar procesamiento cronológico
    const eventosOrdenados = [...eventos].sort((a, b) =>
      new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
    );

    const eventosPorTag = new Map<string, Evento[]>();
    for (const evento of eventosOrdenados) {
      const lista = eventosPorTag.get(evento.tag) || [];
      lista.push(evento);
      eventosPorTag.set(evento.tag, lista);
    }

    // Obtener todas las estaciones con sus TAGs
    const tags = Array.from(eventosPorTag.keys());
    const { data: estaciones } = await supabase
      .from('estaciones')
      .select('*, ruta:rutas(*)')
      .in('tag', tags)
      .eq('activa', true);

    if (!estaciones || estaciones.length === 0) {
      // No hay estaciones registradas con estos TAGs
      await marcarEventosProcesados(eventos.map(e => e.id));
      return resultado;
    }

    // Crear mapa TAG -> Estación
    const estacionPorTag = new Map<string, Estacion & { ruta: any }>();
    for (const estacion of estaciones) {
      estacionPorTag.set(estacion.tag, estacion);
    }

    // Procesar cada evento
    for (const evento of eventosOrdenados) {
      const estacion = estacionPorTag.get(evento.tag);
      if (!estacion) {
        // TAG no registrado, ignorar
        continue;
      }

      const fechaEvento = new Date(evento.fecha_hora);

      // Buscar turno activo para la ruta de esta estación
      const { data: turnosActivos } = await supabase
        .from('turnos')
        .select('*')
        .eq('ruta_id', estacion.ruta_id)
        .lte('inicio', evento.fecha_hora)
        .gte('fin', evento.fecha_hora);

      if (!turnosActivos || turnosActivos.length === 0) {
        // No hay turno activo para esta ruta en este momento
        continue;
      }

      const turno = turnosActivos[0];

      // Si es estación 1, verificamos si es inicio o fin de ronda
      let esInicio = true;
      if (estacion.orden === 1) {
        // Verificar si ya hay una ronda abierta que necesite cierre
        const { data: rondasAbiertas } = await supabase
          .from('rondas')
          .select('id, inicio, created_at')
          .eq('turno_id', turno.id)
          .eq('ruta_id', estacion.ruta_id)
          .is('fin', null)
          .order('inicio', { ascending: false })
          .limit(1);

        if (rondasAbiertas && rondasAbiertas.length > 0) {
          const rondaAbierta = rondasAbiertas[0];
          // Si la ronda abierta tiene más de unos minutos o ya tiene detalles, asumimos que este E1 es el cierre
          // Para evitar "rebotes" de E1 (doble lectura al inicio), verificamos tiempo
          const inicioRonda = new Date(rondaAbierta.inicio || rondaAbierta.created_at);
          const diffSegudos = (fechaEvento.getTime() - inicioRonda.getTime()) / 1000;

          if (diffSegudos > 60) { // Si pasaron más de 60 segundos
            // VALIDACIÓN ANTI-ZOMBIE: 
            // Si la ronda abierta tiene más de 4 horas (14400s), asumimos que es una ronda olvidada.
            // En ese caso, CERRAMOS la anterior (como incompleta/abandonada) y permitimos que este evento inicie una NUEVA.
            if (diffSegudos < 14400) {
              esInicio = false;
              // Es cierre normal, lo tratamos como estación intermedia (que finaliza)
              await procesarEstacionIntermedia(evento, estacion, turno, resultado);
            } else {
              // Ronda Zombie detectada. La cerramos forzosamente.
              // Usamos la fecha del evento actual o la ventana fin para cerrarla? 
              // Mejor la fecha actual para que quede registro de cuándo se "detectó" el cierre.
              // El estatus será INCOMPLETA porque le faltará el cierre E1 válido (este E1 es de la nueva).
              await finalizarRonda(rondaAbierta.id, new Date(inicioRonda.getTime() + 14400000).toISOString(), estacion.ruta_id); // Cerramos con tiempo límite teórica

              // Dejamos esInicio = true, por lo que el código de abajo creará una NUEVA ronda.
            }
          }
        }
      }

      if (esInicio) {
        if (estacion.orden === 1) {
          await procesarInicioRonda(evento, estacion, turno, resultado);
        } else {
          await procesarEstacionIntermedia(evento, estacion, turno, resultado);
        }
      }
    }

    // Marcar eventos como procesados
    await marcarEventosProcesados(eventos.map(e => e.id));

    return resultado;
  } catch (error) {
    console.error('Error procesando eventos:', error);
    resultado.errores.push(String(error));
    return resultado;
  }
}

async function procesarInicioRonda(
  evento: Evento,
  estacion: Estacion & { ruta: any },
  turno: Turno,
  resultado: ResultadoProcesamiento
) {
  const fechaEvento = new Date(evento.fecha_hora);
  const frecuenciaMs = estacion.ruta.frecuencia_min * 60 * 1000;

  // Calcular ventana de tiempo para esta ronda
  const inicioTurno = new Date(turno.inicio);
  const diffMs = fechaEvento.getTime() - inicioTurno.getTime();
  const numeroVentana = Math.floor(diffMs / frecuenciaMs);

  const ventanaInicio = new Date(inicioTurno.getTime() + numeroVentana * frecuenciaMs);
  const ventanaFin = new Date(ventanaInicio.getTime() + frecuenciaMs);

  // Verificar si ya existe ronda en esta ventana
  const { data: rondasExistentes } = await supabase
    .from('rondas')
    .select('id')
    .eq('turno_id', turno.id)
    .eq('ruta_id', estacion.ruta_id)
    .gte('ventana_inicio', ventanaInicio.toISOString())
    .lt('ventana_inicio', ventanaFin.toISOString());

  if (rondasExistentes && rondasExistentes.length > 0) {
    // Ya existe ronda, actualizar si es necesario
    const rondaExistente = rondasExistentes[0];
    await agregarDetalleRonda(rondaExistente.id, estacion, evento, 0);
    resultado.rondasAfectadas++;
    return;
  }

  // Crear nueva ronda
  const { data: nuevaRonda, error } = await supabase
    .from('rondas')
    .insert({
      ruta_id: estacion.ruta_id,
      turno_id: turno.id,
      vigilante_id: turno.vigilante_id,
      inicio: evento.fecha_hora,
      ventana_inicio: ventanaInicio.toISOString(),
      ventana_fin: ventanaFin.toISOString(),
      estatus: 'INCOMPLETA' // Se actualizará cuando termine
    })
    .select()
    .single();

  if (error) {
    resultado.errores.push(`Error creando ronda: ${error.message}`);
    return;
  }

  // Agregar detalle de E1
  // La diferencia para E1 es el retraso respecto al inicio nominal de la ventana
  const diferenciaE1 = Math.round((fechaEvento.getTime() - ventanaInicio.getTime()) / 1000);
  await agregarDetalleRonda(nuevaRonda.id, estacion, evento, diferenciaE1);
  resultado.rondasAfectadas++;
}

async function procesarEstacionIntermedia(
  evento: Evento,
  estacion: Estacion & { ruta: any },
  turno: Turno,
  resultado: ResultadoProcesamiento
) {
  // Buscar ronda activa (más reciente que no haya terminado)
  const { data: rondasActivas } = await supabase
    .from('rondas')
    .select('*')
    .eq('turno_id', turno.id)
    .eq('ruta_id', estacion.ruta_id)
    .is('fin', null)
    .order('inicio', { ascending: false })
    .limit(1);

  if (!rondasActivas || rondasActivas.length === 0) {
    // No hay ronda activa, crear ronda inválida (no inició en E1)
    const { data: nuevaRonda } = await supabase
      .from('rondas')
      .insert({
        ruta_id: estacion.ruta_id,
        turno_id: turno.id,
        vigilante_id: turno.vigilante_id,
        inicio: evento.fecha_hora,
        ventana_inicio: evento.fecha_hora,
        ventana_fin: evento.fecha_hora,
        estatus: 'INVALIDA',
        observaciones: 'Ronda no iniciada en Estación 1'
      })
      .select()
      .single();

    if (nuevaRonda) {
      await agregarDetalleRonda(nuevaRonda.id, estacion, evento, 0);
      resultado.rondasAfectadas++;
    }
    return;
  }

  const rondaActiva = rondasActivas[0];

  // Obtener último detalle para calcular diferencia de tiempo
  const { data: ultimoDetalle } = await supabase
    .from('ronda_detalle')
    .select('*, estacion:estaciones(*)')
    .eq('ronda_id', rondaActiva.id)
    .order('fecha_hora', { ascending: false })
    .limit(1)
    .single();

  let diferenciaSeg = 0;
  if (ultimoDetalle && ultimoDetalle.fecha_hora) {
    const fechaAnterior = new Date(ultimoDetalle.fecha_hora);
    const fechaActual = new Date(evento.fecha_hora);
    // Diferencia PUNTO A PUNTO: Tiempo real - Tiempo esperado de esta estación
    diferenciaSeg = Math.round((fechaActual.getTime() - fechaAnterior.getTime()) / 1000) - estacion.tiempo_esperado_seg;
  } else if (rondaActiva.inicio) {
    // Si no hay detalle pero hay inicio de ronda, usamos el inicio
    const fechaAnterior = new Date(rondaActiva.inicio);
    const fechaActual = new Date(evento.fecha_hora);
    diferenciaSeg = Math.round((fechaActual.getTime() - fechaAnterior.getTime()) / 1000) - estacion.tiempo_esperado_seg;
  }

  // VALIDACIÓN TEMPORAL ESTRICTA
  // Si el evento es ANTERIOR al inicio de la ronda, es un error (basura histórica o desorden grave)
  if (rondaActiva.inicio) {
    const inicioRonda = new Date(rondaActiva.inicio);
    if (new Date(evento.fecha_hora) < inicioRonda) {
      // Ignorar evento para esta ronda
      // Podríamos crear una ronda INVALIDA separada, o simplemente loguearlo
      resultado.errores.push(`Evento ignorado por ser anterior al inicio de ronda activa: ${evento.fecha_hora} < ${rondaActiva.inicio}`);
      return;
    }
  }

  // Agregar detalle
  await agregarDetalleRonda(rondaActiva.id, estacion, evento, diferenciaSeg);

  // Si es E1 de nuevo, significa que terminó la ronda
  if (estacion.orden === 1) {
    await finalizarRonda(rondaActiva.id, evento.fecha_hora, estacion.ruta_id);
  }

  resultado.rondasAfectadas++;
}

async function agregarDetalleRonda(
  rondaId: string,
  estacion: Estacion,
  evento: Evento,
  diferenciaSeg: number
) {
  // Determinar estatus del detalle
  let estatus = 'A_TIEMPO';
  if (Math.abs(diferenciaSeg) > estacion.tolerancia_seg) {
    estatus = 'RETRASADO';
  }

  // Verificar si ya existe detalle para esta estación en esta ronda
  const { data: detalleExistente } = await supabase
    .from('ronda_detalle')
    .select('id')
    .eq('ronda_id', rondaId)
    .eq('estacion_id', estacion.id)
    .single();

  if (detalleExistente) {
    // Actualizar existente
    await supabase
      .from('ronda_detalle')
      .update({
        evento_id: evento.id,
        fecha_hora: evento.fecha_hora,
        diferencia_seg: diferenciaSeg,
        estatus
      })
      .eq('id', detalleExistente.id);
  } else {
    // Crear nuevo
    await supabase
      .from('ronda_detalle')
      .insert({
        ronda_id: rondaId,
        estacion_id: estacion.id,
        evento_id: evento.id,
        orden: estacion.orden,
        fecha_hora: evento.fecha_hora,
        diferencia_seg: diferenciaSeg,
        estatus
      });
  }
}

async function finalizarRonda(rondaId: string, fechaFin: string, rutaId: string) {
  // Obtener todas las estaciones de la ruta
  const { data: estaciones } = await supabase
    .from('estaciones')
    .select('id')
    .eq('ruta_id', rutaId)
    .eq('activa', true);

  // Obtener detalles de la ronda
  const { data: detalles } = await supabase
    .from('ronda_detalle')
    .select('*')
    .eq('ronda_id', rondaId);

  const totalEstaciones = estaciones?.length || 0;
  const detallesRegistrados = detalles?.length || 0;

  // Determinar estatus final
  let estatusFinal = 'COMPLETA';

  // Verificar si faltan estaciones
  if (detallesRegistrados < totalEstaciones) {
    estatusFinal = 'INCOMPLETA';
  }

  // Verificar si hay retrasados
  const tieneRetrasados = detalles?.some(d => d.estatus === 'RETRASADO');
  if (tieneRetrasados) {
    estatusFinal = 'INCOMPLETA';
  }

  // Verificar secuencia (E1 al inicio y al final)
  // IMPORTANTE: Ordenar por fecha_hora para ver el recorrido real
  const detallesOrdenados = detalles?.sort((a, b) =>
    new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
  ) || [];

  if (detallesOrdenados.length > 0) {
    const primero = detallesOrdenados[0];
    const ultimo = detallesOrdenados[detallesOrdenados.length - 1];

    if (primero.orden !== 1) {
      estatusFinal = 'INVALIDA'; // No empezó en E1
    }

    // Validar que termine en E1 para considerarse COMPLETA
    // Si no termina en E1, sigue siendo INCOMPLETA (o INVALIDA segun regla, pero dejemos INCOMPLETA)
    if (ultimo.orden !== 1) {
      estatusFinal = 'INCOMPLETA';
    } else {
      // Terminó en E1. Si ya verificamos cobertura de estaciones y tiempos...
      // Ya calculamos estatusFinal basado en cobertura arriba.
      // Si cobertura OK, tiempos OK, y fin en E1 -> COMPLETA.
    }
  }

  // Actualizar ronda
  await supabase
    .from('rondas')
    .update({
      fin: fechaFin,
      estatus: estatusFinal,
      updated_at: new Date().toISOString()
    })
    .eq('id', rondaId);
}

async function marcarEventosProcesados(eventosIds: string[]) {
  if (eventosIds.length === 0) return;

  await supabase
    .from('eventos')
    .update({ procesado: true })
    .in('id', eventosIds);
}

/**
 * Genera rondas NO_REALIZADA para ventanas sin actividad
 * Ejecutar periódicamente (ej: cada hora)
 */
export async function generarRondasNoRealizadas() {
  const ahora = new Date();
  const hace2Horas = new Date(ahora.getTime() - 2 * 60 * 60 * 1000);

  // Obtener turnos activos
  const { data: turnosActivos } = await supabase
    .from('turnos')
    .select(`
      *,
      ruta:rutas(frecuencia_min)
    `)
    .lte('inicio', ahora.toISOString())
    .gte('fin', ahora.toISOString());

  if (!turnosActivos) return;

  for (const turno of turnosActivos) {
    const inicioTurno = new Date(turno.inicio);
    const frecuenciaMs = turno.ruta.frecuencia_min * 60 * 1000;

    // Calcular ventanas pasadas
    let ventanaInicio = new Date(inicioTurno);

    while (ventanaInicio < hace2Horas) {
      const ventanaFin = new Date(ventanaInicio.getTime() + frecuenciaMs);

      // Verificar si existe ronda para esta ventana
      const { data: rondaExistente } = await supabase
        .from('rondas')
        .select('id')
        .eq('turno_id', turno.id)
        .eq('ruta_id', turno.ruta_id)
        .gte('ventana_inicio', ventanaInicio.toISOString())
        .lt('ventana_inicio', ventanaFin.toISOString())
        .single();

      if (!rondaExistente) {
        // Crear ronda NO_REALIZADA
        await supabase
          .from('rondas')
          .insert({
            ruta_id: turno.ruta_id,
            turno_id: turno.id,
            vigilante_id: turno.vigilante_id,
            ventana_inicio: ventanaInicio.toISOString(),
            ventana_fin: ventanaFin.toISOString(),
            estatus: 'NO_REALIZADA',
            observaciones: 'Ronda no iniciada en ventana de tiempo'
          });
      }

      ventanaInicio = ventanaFin;
    }
  }
}
