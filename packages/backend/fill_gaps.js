
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fillGaps() {
    console.log('Generando rondas NO_REALIZADA para histórico de enero...');

    const inicioEnero = new Date('2026-01-01T00:00:00Z');
    const ahora = new Date();

    // Obtener todos los turnos desde enero
    const { data: turnos, error } = await supabase
        .from('turnos')
        .select('*, ruta:rutas(frecuencia_min)')
        .gte('inicio', inicioEnero.toISOString());

    if (error) {
        console.error('Error obteniendo turnos:', error);
        return;
    }

    console.log(`Procesando ${turnos.length} turnos...`);

    for (const turno of turnos) {
        const inicioTurno = new Date(turno.inicio);
        const finTurno = new Date(turno.fin);
        const frecuenciaMs = turno.ruta.frecuencia_min * 60 * 1000;

        let ventanaInicio = new Date(inicioTurno);
        while (ventanaInicio < finTurno && ventanaInicio < ahora) {
            const ventanaFin = new Date(ventanaInicio.getTime() + frecuenciaMs);

            // Verificar si ya existe ronda (realizada o no)
            const { data: rondaExistente } = await supabase
                .from('rondas')
                .select('id')
                .eq('turno_id', turno.id)
                .eq('ruta_id', turno.ruta_id)
                .gte('ventana_inicio', ventanaInicio.toISOString())
                .lt('ventana_inicio', ventanaFin.toISOString())
                .single();

            if (!rondaExistente) {
                await supabase
                    .from('rondas')
                    .insert({
                        ruta_id: turno.ruta_id,
                        turno_id: turno.id,
                        vigilante_id: turno.vigilante_id,
                        ventana_inicio: ventanaInicio.toISOString(),
                        ventana_fin: ventanaFin.toISOString(),
                        estatus: 'NO_REALIZADA',
                        observaciones: 'Ronda no iniciada (Histórico reconstruido)'
                    });
            }
            ventanaInicio = ventanaFin;
        }
    }

    console.log('Proceso de llenado de huecos finalizado.');
}

fillGaps();
