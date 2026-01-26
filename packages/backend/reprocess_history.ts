
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { procesarEventos } from './src/services/motorRondas';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '.env') });

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

    // Delete all rounds and details (cascade should handle details if configured, but let's be explicit/safe)
    // supabase cascade usually works if defined in schema. The schema says:
    // ronda_id UUID NOT NULL REFERENCES rondas(id) ON DELETE CASCADE
    // So deleting rondas is enough.

    const { error: deleteError } = await supabase
        .from('rondas')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
        console.error('Error borrando rondas:', deleteError);
        return;
    }

    console.log('Rondas eliminadas. Obteniendo eventos...');

    // 2. Fetch all events
    // We want ALL events.
    const { data: eventos, error: eventosError } = await supabase
        .from('eventos')
        .select('*')
        .order('fecha_hora', { ascending: true }); // Get them sorted initially, helpful

    if (eventosError || !eventos) {
        console.error('Error obteniendo eventos:', eventosError);
        return;
    }

    console.log(`Se encontraron ${eventos.length} eventos. Procesando...`);

    // 3. Process in batches to avoid memory/timeout issues if large?
    // motorRondas loops one by one, but `procesarEventos` is the entry point.
    // We can pass all of them. The logic inside sorts them anyway.

    // Reset 'procesado' flag?
    // procesarEventos sets 'procesado' = true at the end.
    // It consumes them regardless of the flag if we pass them explicitly.
    // But inside procesarEventos, it doesn't query the DB for *more* events, it uses the arg.
    // So we are good.

    // NOTE: motorRondas queries 'turnos'. If this history spans many months, it might be slow.
    // But for now let's assume reasonable volume.

    const CHUNK_SIZE = 500; // Process in chunks to give feedback and maybe help with memory?
    // Wait, if we chunk, we might break the "Start -> End" flow if a round spans across a chunk boundary?
    // NO. `procesarEventos` sorts locally.
    // If we assume the input `eventos` is globally sorted (it is effectively), 
    // and we chunk it, we might cut a round in half?
    // Yes. If E1 (start) is in Chunk A and E2 is in Chunk B.
    // When processing Chunk B, `procesarEventos` will look for 'rondasActivas' in the DB.
    // Since Chunk A already wrote to the DB, Chunk B should find the open round!
    // So chunking IS safe, provided we process chunks consistently in chronological order.

    const chunks = [];
    for (let i = 0; i < eventos.length; i += CHUNK_SIZE) {
        chunks.push(eventos.slice(i, i + CHUNK_SIZE));
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
