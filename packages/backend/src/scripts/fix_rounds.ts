
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRounds() {
    console.log('=== RECALCULANDO TODAS LAS RONDAS ===');

    // Obtener todas las rondas
    const { data: rondas, error: errorRondas } = await supabase
        .from('rondas')
        .select('id, inicio, estatus, ruta_id')
        .order('created_at', { ascending: false });

    if (errorRondas) {
        console.error('Error fetching rounds:', errorRondas);
        return;
    }

    console.log(`Found ${(rondas as any[]).length} rounds.`);

    let rondasCorregidas = 0;
    let detallesCorregidos = 0;

    for (const ronda of (rondas as any[])) {
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
            .order('orden', { ascending: true }); // CRITICAL: Sorted by order

        if (errorDetalles || !detalles || (detalles as any[]).length === 0) continue;

        let rondaModificada = false;
        let tieneRetrasados = false;

        for (let i = 0; i < (detalles as any[]).length; i++) {
            const detalle = (detalles as any[])[i] as any;
            if (!detalle.fecha_hora || !detalle.estacion) continue;

            let nuevaDiferencia = 0;
            let nuevoEstatus = 'A_TIEMPO';

            if (i === 0) {
                nuevaDiferencia = detalle.diferencia_seg;
            } else {
                // Estaciones intermedias: calcular intervalo punto a punto
                const detalleAnterior = (detalles as any[])[i - 1] as any;

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

            if (Math.abs(nuevaDiferencia) > tolerancia) {
                nuevoEstatus = 'RETRASADO';
            } else {
                nuevoEstatus = 'A_TIEMPO';
            }

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
        const { data: estaciones } = await supabase
            .from('estaciones')
            .select('id')
            .eq('ruta_id', ronda.ruta_id)
            .eq('activa', true);

        const totalEstaciones = (estaciones as any[])?.length || 0;

        let nuevoEstatusRonda = ronda.estatus;

        // Recalculate Round Status completely
        const uniqueVisited = new Set((detalles as any[]).map(d => d.estacion?.id || d.estacion_id)).size;

        if (uniqueVisited < totalEstaciones) {
            nuevoEstatusRonda = 'INCOMPLETA';
        } else if (tieneRetrasados) {
            nuevoEstatusRonda = 'INCOMPLETA';
        } else {
            // Verificar secuencia (Ordenar por fecha_hora)
            const ordenadosPorTiempo = (detalles as any[]).sort((a, b) =>
                new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
            );

            const primero = ordenadosPorTiempo[0];
            const ultimo = ordenadosPorTiempo[ordenadosPorTiempo.length - 1];

            if (primero.orden !== 1) {
                nuevoEstatusRonda = 'INVALIDA';
            } else if (ultimo.orden !== 1) {
                nuevoEstatusRonda = 'INCOMPLETA';
            } else {
                nuevoEstatusRonda = 'COMPLETA';
            }
        }

        if (nuevoEstatusRonda !== ronda.estatus) {
            await supabase
                .from('rondas')
                .update({ estatus: nuevoEstatusRonda })
                .eq('id', ronda.id);
            rondasCorregidas++;
        }
    }

    console.log(`\nRecálculo completado: ${rondasCorregidas} rondas corregidas, ${detallesCorregidos} detalles corregidos.`);
}

fixRounds();
