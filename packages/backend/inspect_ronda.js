
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectRonda() {
    // Get latest ronda details that match the pattern in the screenshot
    const { data: details, error } = await supabase
        .from('ronda_detalle')
        .select('*, rondas(*), estaciones(*)')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    // Find the ronda ID from these details
    const rondaId = details[0].ronda_id;
    console.log('Inspecting Ronda ID:', rondaId);

    const { data: allDetails, error: error2 } = await supabase
        .from('ronda_detalle')
        .select('*, estaciones(*)')
        .eq('ronda_id', rondaId)
        .order('orden', { ascending: true });

    if (error2) {
        console.error(error2);
        return;
    }

    console.log('Details for Ronda:');
    allDetails.forEach(d => {
        console.log(`Ord ${d.orden} (${d.estaciones.nombre}): Hora: ${d.fecha_hora}, Diff: ${d.diferencia_seg}, Exp: ${d.estaciones.tiempo_esperado_seg}`);
    });
}

inspectRonda();
