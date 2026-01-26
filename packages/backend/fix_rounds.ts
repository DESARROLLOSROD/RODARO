
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '.env') });

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

    console.log(`Found ${rondas.length} rounds.`);

    let rondasCorregidas = 0;
    let detallesCorregidos = 0;

    for (const ronda of rondas) {
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

        if (errorDetalles || !detalles || detalles.length === 0) continue;

        let rondaModificada = false;
        let tieneRetrasados = false;
        let tieneInvalidos = false;

        // First validation loop: Check timestamps against station order
        // If we have timestamps 21:15 (St 1) and 21:01 (St 2), something is wrong.
        // However, we can only fix the *intervals*. We cannot fix the timestamps themselves unless we assume they are swapped.
        // For now, we only recalculate intervals based on the recorded timestamps.

        for (let i = 0; i < detalles.length; i++) {
            const detalle = detalles[i] as any;
            if (!detalle.fecha_hora || !detalle.estacion) continue;

            let nuevaDiferencia = 0;
            let nuevoEstatus = 'A_TIEMPO';

            if (i === 0) {
                // Primera estación: diferencia es 0 (punto de partida)
                // OJO: En motorRondas original, la diff de E1 era vs ventana inicio.
                // Pero aquí simplificamos a 0 si no tenemos info de ventana, o mantenemos la existente si parece válida.
                // Para "recalcular-todas" en rondas.ts asumía 0.
                // Vamos a asumir 0 para limpiar el ruido, o dejarla si es razonable.
                // Mejor dejemos la diferencia original de E1 si existe, ya que depende de la ventana del turno.
                // SIEMPRE QUE NO SEA NEGATIVA LOCA.
                nuevaDiferencia = detalle.diferencia_seg;
            } else {
                // Estaciones intermedias: calcular intervalo punto a punto
                const detalleAnterior = detalles[i - 1] as any;

                if (detalleAnterior.fecha_hora && detalleAnterior.estacion) {
                    const fechaAnterior = new Date(detalleAnterior.fecha_hora);
                    const fechaActual = new Date(detalle.fecha_hora);
                    const tiempoReal = Math.round((fechaActual.getTime() - fechaAnterior.getTime()) / 1000);

                    // Calcular intervalo esperado (diferencia entre tiempos acumulados definidos en ruta)
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

            // Si la diferencia es positiva y mayor a tolerancia => RETRASADO
            // Si es negativa y mayor a tolerancia => ADELANTADO (pero el sistema solo marca RETRASADO o A_TIEMPO por ahora en tipos)
            // El tipo estatus_detalle es: 'A_TIEMPO', 'RETRASADO', 'OMITIDO'.
            // Si llegó muy temprano (negativo grande), ¿es A_TIEMPO? Digamos que sí por ahora, o definamos.
            // La lógica original : Math.abs(diferenciaSeg) > tolerancia -> RETRASADO.
            if (Math.abs(nuevaDiferencia) > tolerancia) {
                nuevoEstatus = 'RETRASADO';
            } else {
                nuevoEstatus = 'A_TIEMPO';
            }

            if (nuevoEstatus === 'RETRASADO') tieneRetrasados = true;
            if (detalle.estatus === 'INVALIDO') tieneInvalidos = true; // Si existiera ese estado en detalle

            // Fix: Check if timestamps are inverted (Time Travel check)
            // If fechaActual < fechaAnterior, it's physically impossible in a valid round.
            // We log it but proceed with the math (will result in huge negative diff).
            // No custom handling for now, just consistent math.

            // Solo actualizar si hay cambios
            if (detalle.diferencia_seg !== nuevaDiferencia || detalle.estatus !== nuevoEstatus) {
                await supabase
                    .from('ronda_detalle')
                    .update({ diferencia_seg: nuevaDiferencia, estatus: nuevoEstatus })
                    .eq('id', detalle.id);

                detallesCorregidos++;
                rondaModificada = true;
                // process.stdout.write('.');
            }
        }

        // Actualizar estatus de la ronda si es necesario
        const { data: estaciones } = await supabase
            .from('estaciones')
            .select('id')
            .eq('ruta_id', ronda.ruta_id)
            .eq('activa', true);

        const totalEstaciones = estaciones?.length || 0;

        let nuevoEstatusRonda = ronda.estatus;

        // Recalculate Round Status completely
        if (detalles.length < totalEstaciones) {
            nuevoEstatusRonda = 'INCOMPLETA';
        } else if (tieneRetrasados) {
            nuevoEstatusRonda = 'INCOMPLETA';
        } else {
            // Verificar Orden
            // Check E1 start and match
            const ordenados = detalles.sort((a, b) => a.orden - b.orden);
            if (ordenados[0].orden !== 1) {
                nuevoEstatusRonda = 'INVALIDA';
            } else {
                nuevoEstatusRonda = 'COMPLETA';
            }
        }

        // Override: If previously 'NO_REALIZADA', it stays that way unless we found details?
        // If it has details, it's not NO_REALIZADA.
        if (ronda.estatus === 'NO_REALIZADA' && detalles.length > 0) {
            // It was revived?
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
