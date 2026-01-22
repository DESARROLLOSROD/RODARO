
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AGENT_API_TOKEN = process.env.AGENT_API_TOKEN;
const API_URL = 'http://localhost:3001/api';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function recalibrarTodo() {
    console.log('Reiniciando estado de procesamiento...');
    const { error: resetError } = await supabase
        .from('eventos')
        .update({ procesado: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');

    if (resetError) {
        console.error('Error al reiniciar:', resetError);
        return;
    }

    console.log('Borrando detalles de rondas antiguos...');
    await supabase.from('ronda_detalle').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('Borrando rondas para reconstrucción completa...');
    await supabase.from('rondas').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    let pendientes = 1;
    while (pendientes > 0) {
        console.log('Procesando lote de 500 eventos...');
        try {
            const response = await axios.post(`${API_URL}/eventos/reprocesar`, {}, {
                headers: { 'x-agent-token': AGENT_API_TOKEN }
            });

            const { data } = response;
            console.log(`Lote completado: ${data.procesados} eventos procesados, ${data.rondas_afectadas} rondas afectadas.`);

            const { count, error: countError } = await supabase
                .from('eventos')
                .select('id', { count: 'exact', head: true })
                .eq('procesado', false);

            if (countError) throw countError;

            pendientes = count || 0;
            console.log(`Quedan ${pendientes} eventos por procesar.`);

            if (data.procesados === 0 && pendientes > 0) {
                console.log('Atención: Hay pendientes pero no se procesó nada. Saliendo para evitar loop infinito.');
                break;
            }
        } catch (e) {
            console.error('Error en el reprocesamiento:', e.message);
            break;
        }
    }

    console.log('Recalibración finalizada.');
}

recalibrarTodo();
