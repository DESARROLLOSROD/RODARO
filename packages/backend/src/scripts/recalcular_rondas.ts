/**
 * Script para recalcular diferencias de todas las rondas existentes
 * Corrige el bug donde los tiempos se acumulaban en lugar de calcularse punto a punto
 *
 * Ejecutar: npx tsx src/scripts/recalcular_rondas.ts
 */

import { supabase } from '../config/supabase';

async function recalcularRondas() {
  console.log('=== RECALCULANDO RONDAS ===\n');

  // Obtener todas las rondas con detalles
  const { data: rondas, error: errorRondas } = await supabase
    .from('rondas')
    .select(`
      id,
      inicio,
      estatus,
      ruta_id
    `)
    .order('created_at', { ascending: false });

  if (errorRondas) {
    console.error('Error obteniendo rondas:', errorRondas);
    return;
  }

  console.log(`Encontradas ${rondas.length} rondas para procesar\n`);

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

    if (errorDetalles || !detalles || detalles.length === 0) {
      continue;
    }

    let rondaModificada = false;
    let tieneRetrasados = false;

    for (let i = 0; i < detalles.length; i++) {
      const detalle = detalles[i] as any;

      if (!detalle.fecha_hora || !detalle.estacion) continue;

      let nuevaDiferencia: number;

      if (i === 0) {
        // Primera estación: diferencia desde inicio de ronda
        nuevaDiferencia = 0;
      } else {
        // Estaciones intermedias: calcular intervalo punto a punto
        const detalleAnterior = detalles[i - 1] as any;

        if (detalleAnterior.fecha_hora && detalleAnterior.estacion) {
          const fechaAnterior = new Date(detalleAnterior.fecha_hora);
          const fechaActual = new Date(detalle.fecha_hora);
          const tiempoReal = Math.round((fechaActual.getTime() - fechaAnterior.getTime()) / 1000);

          // Calcular intervalo esperado (tiempo desde estación anterior)
          const intervaloEsperado = detalle.estacion.tiempo_esperado_seg || 0;

          nuevaDiferencia = tiempoReal - intervaloEsperado;
        } else {
          nuevaDiferencia = detalle.diferencia_seg || 0;
        }
      }

      // Determinar nuevo estatus
      const tolerancia = detalle.estacion.tolerancia_seg || 300;
      const nuevoEstatus = Math.abs(nuevaDiferencia) > tolerancia ? 'RETRASADO' : 'A_TIEMPO';

      if (nuevoEstatus === 'RETRASADO') {
        tieneRetrasados = true;
      }

      // Solo actualizar si hay cambios
      if (detalle.diferencia_seg !== nuevaDiferencia || detalle.estatus !== nuevoEstatus) {
        const { error: errorUpdate } = await supabase
          .from('ronda_detalle')
          .update({
            diferencia_seg: nuevaDiferencia,
            estatus: nuevoEstatus
          })
          .eq('id', detalle.id);

        if (!errorUpdate) {
          detallesCorregidos++;
          rondaModificada = true;
          console.log(`  Detalle orden ${detalle.orden}: ${detalle.diferencia_seg}s -> ${nuevaDiferencia}s (${detalle.estatus} -> ${nuevoEstatus})`);
        }
      }
    }

    // Actualizar estatus de la ronda si es necesario
    if (rondaModificada) {
      rondasCorregidas++;

      // Obtener total de estaciones de la ruta
      const { data: estaciones } = await supabase
        .from('estaciones')
        .select('id')
        .eq('ruta_id', ronda.ruta_id)
        .eq('activa', true);

      const totalEstaciones = estaciones?.length || 0;

      // Contar estaciones únicas visitadas
      const estacionesVisitadas = new Set(detalles.map(d => (d as any).estacion?.id || (d as any).estacion_id));
      const totalUniqueVisitadas = estacionesVisitadas.size;

      let nuevoEstatusRonda = ronda.estatus;

      // Si la ronda estaba INCOMPLETA solo por retrasados, verificar si ahora está completa
      if (ronda.estatus === 'INCOMPLETA' && !tieneRetrasados && totalUniqueVisitadas >= totalEstaciones) {
        nuevoEstatusRonda = 'COMPLETA';
      } else if (tieneRetrasados && ronda.estatus === 'COMPLETA') {
        nuevoEstatusRonda = 'INCOMPLETA';
      }

      if (nuevoEstatusRonda !== ronda.estatus) {
        await supabase
          .from('rondas')
          .update({ estatus: nuevoEstatusRonda })
          .eq('id', ronda.id);

        console.log(`  Ronda ${ronda.id}: ${ronda.estatus} -> ${nuevoEstatusRonda}`);
      }

      console.log(`Ronda ${ronda.id} procesada\n`);
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log(`Rondas corregidas: ${rondasCorregidas}`);
  console.log(`Detalles corregidos: ${detallesCorregidos}`);
  console.log('\nProceso completado.');
}

recalcularRondas().catch(console.error);
