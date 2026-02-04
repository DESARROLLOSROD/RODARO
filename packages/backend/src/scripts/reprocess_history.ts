
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { procesarEventos } from '../services/motorRondas';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function reprocessHistory() {
    console.log('=== REPROCESANDO HISTORIAL COMPLETO ===');
    console.log('1. Eliminando rondas existentes (limpieza)...');

    const { error: deleteError } = await supabase
        .from('rondas')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
        console.error('Error borrando rondas:', deleteError);
        return;
    }

    console.log('Rondas eliminadas. Obteniendo eventos...');

    const { data: eventos, error: eventosError } = await supabase
        .from('eventos')
        .select('*')
        .order('fecha_hora', { ascending: true });

    if (eventosError || !eventos) {
        console.error('Error obteniendo eventos:', eventosError);
        return;
    }

    console.log(`Se encontraron ${eventos.length} eventos. Procesando...`);

    const CHUNK_SIZE = 500;
    const chunks = [];
    for (let i = 0; i < (eventos as any[]).length; i += CHUNK_SIZE) {
        chunks.push((eventos as any[]).slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
        console.log(`Procesando lote ${i + 1} de ${chunks.length} (${chunks[i].length} eventos)...`);
        const resultado = await procesarEventos(chunks[i]);
        if (resultado.errores.length > 0) {
            console.warn('Advertencias en lote:', resultado.errores);
        }
    }

    console.log('=== REPROCESAMIENTO FINALIZADO ===');
}

reprocessHistory();
