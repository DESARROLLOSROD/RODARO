
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { procesarEventos } from './src/services/motorRondas';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function runTest() {
    console.log('=== PROCESANDO CASO DE PRUEBA DE USUARIO ===');

    const content = fs.readFileSync('test_case_user.txt', 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l);
    const eventos: any[] = [];

    for (const linea of lines) {
        // Format: YYYYMMDDHHmmss 31 TAG
        const parts = linea.split(/\s+/);
        if (parts.length >= 3) {
            const f = parts[0];
            const date = new Date(
                parseInt(f.substring(0, 4)),
                parseInt(f.substring(4, 6)) - 1,
                parseInt(f.substring(6, 8)),
                parseInt(f.substring(8, 10)),
                parseInt(f.substring(10, 12)),
                parseInt(f.substring(12, 14))
            );

            eventos.push({
                id: crypto.randomUUID(),
                tag: parts[2].toUpperCase(),
                fecha_hora: date.toISOString(),
                procesado: false,
                datos_crudos: linea
            });
        }
    }

    console.log(`Eventos parseados: ${eventos.length}`);
    if (eventos.length > 0) {
        console.log(`Inicio: ${eventos[0].fecha_hora}`);
        console.log(`Fin: ${eventos[eventos.length - 1].fecha_hora}`);
    }

    // Ensure these events exist in DB for foreign key constraints if needed?
    // motorRondas uses 'turnos' and 'estaciones'. 
    // We assume the TAGS exist in 'estaciones'.
    // We assume there is a 'turno' covering 2026-01-01.
    // If not, it will be skipped.
    // Let's Insert them into 'eventos' table first to mimic real flow?
    // Or just pass them to logic?
    // Logic works with objects, but it queries DB for relations.
    // Let's try passing directly.

    // NOTE: motorRondas checks 'procesado' status if we pulled from DB, 
    // but here we pass fresh objects.

    const resultado = await procesarEventos(eventos);
    console.log('Resultado:', resultado);

    // Now verify what happened in DB
    // We can query 'rondas' for this date
    if (eventos.length > 0) {
        const start = new Date(eventos[0].fecha_hora);
        start.setMinutes(start.getMinutes() - 10);
        const end = new Date(eventos[eventos.length - 1].fecha_hora);
        end.setMinutes(end.getMinutes() + 10);

        const { data: rondas } = await supabase
            .from('rondas')
            .select('*, detalles:ronda_detalle(*)')
            .gte('inicio', start.toISOString())
            .lte('inicio', end.toISOString());

        console.log('\n--- RONDAS GENERADAS ---');
        if (rondas && rondas.length > 0) {
            rondas.forEach(r => {
                console.log(`ID: ${r.id}`);
                console.log(`Estatus: ${r.estatus}`);
                console.log(`Inicio: ${r.inicio}`);
                console.log(`Fin: ${r.fin}`);
                console.log(`Detalles: ${r.detalles.length}`);
            });
        } else {
            console.log('No se generaron rondas. (Tal vez no había turno activo para esa fecha?)');
        }
    }
}

runTest();
