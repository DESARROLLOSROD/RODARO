
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyFinalDetails() {
    const { data: details, error } = await supabase
        .from('ronda_detalle')
        .select('*, estaciones(*)')
        .order('ronda_id, orden', { ascending: true })
        .limit(50);

    if (error) {
        console.error(error);
        return;
    }

    let lastTime = null;
    let lastRondaId = null;

    console.log('--- VERIFICACIÓN PUNTO A PUNTO ---');
    details.forEach(d => {
        if (d.ronda_id !== lastRondaId) {
            console.log(`\nNueva Ronda: ${d.ronda_id}`);
            lastTime = null;
            lastRondaId = d.ronda_id;
        }

        const currentTime = new Date(d.fecha_hora);
        let calcDiff = 0;

        if (d.orden === 1) {
            // Para E1, calcDiff es vs ventana (complicado de verificar aquí sin la ronda)
            console.log(`Ord ${d.orden}: E1 - Diff DB: ${d.diferencia_seg}`);
        } else if (lastTime) {
            const interval = Math.round((currentTime - lastTime) / 1000);
            const expected = d.estaciones.tiempo_esperado_seg || 0;
            calcDiff = interval - expected;
            const match = calcDiff === d.diferencia_seg;
            console.log(`Ord ${d.orden}: Interval ${interval}s, Exp ${expected}s, CalcDiff ${calcDiff}s, DBDiff ${d.diferencia_seg}s -> ${match ? 'OK' : 'ERROR'}`);
        }

        lastTime = currentTime;
    });
}

verifyFinalDetails();
