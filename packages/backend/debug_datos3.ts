
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { procesarEventos } from './src/services/motorRondas';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function debugDatos3() {
    console.log('=== DEBUGGING DATOS3.txt ===');

    const content = fs.readFileSync('../../DATOS3.txt', 'utf-8'); // Adjust path to root where file likely is?
    // User path: c:\Users\ADMIN_SISTEMAS\OneDrive - Desarrollos ROD\Documentos\Desarrollos\RODARO\DATOS3.txt
    // Script path: c:\Users\ADMIN_SISTEMAS\OneDrive - Desarrollos ROD\Documentos\Desarrollos\RODARO\packages\backend\debug_datos3.ts
    // So relative path is ../../DATOS3.txt

    const lines = content.split('\n').map(l => l.trim()).filter(l => l);
    const eventos: any[] = [];

    for (const linea of lines) {
        if (linea.startsWith('H ')) continue;
        // Format: YYYYMMDDHHmmss 31 TAG
        // Regex from frontend: /^(\d{14})\s+(\d+)\s+([0-9A-Fa-f]{10,16})$/
        const match = linea.match(/^(\d{14})\s+(\d+)\s+([0-9A-Fa-f]{10,16})$/);
        if (match) {
            const f = match[1];
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
                tag: match[3].toUpperCase(),
                fecha_hora: date.toISOString(),
                procesado: false,
                datos_crudos: linea
            });
        }
    }

    console.log(`Eventos parseados: ${eventos.length}`);

    // Clean DB for this date range to simulate fresh upload logic?
    // Or just trust logic response.
    // Ideally we want to see why it considers INVALID.
    // motorRondas returns { rondas_afectadas: number, errores: string[] }
    // It doesn't return the *status* of rounds directly, but it updates DB.

    // Let's filter for just the first day to keep it fast and focused
    const eventosDia1 = eventos.filter(e => e.fecha_hora.startsWith('2026-01-01'));
    console.log(`Eventos Dia 1: ${eventosDia1.length}`);

    // We need to fetch Turnos/Estaciones for this to work.
    // Assuming they exist.

    const resultado = await procesarEventos(eventosDia1);
    console.log('Resultado Procesamiento:', resultado);

    // Query Generated Rounds
    const { data: rondas } = await supabase
        .from('rondas')
        .select('*, detalles:ronda_detalle(*)')
        .gte('inicio', '2026-01-01T00:00:00Z')
        .lte('inicio', '2026-01-01T23:59:59Z');

    if (rondas) {
        rondas.forEach(r => {
            console.log(`\nRonda ID: ${r.id}`);
            console.log(`Estatus: ${r.estatus}`);
            console.log(`Inicio: ${r.inicio}`);
            console.log(`Fin: ${r.fin}`);
            console.log(`Detalles Count: ${r.detalles.length}`);

            // Verify Start/End details
            if (r.detalles.length > 0) {
                const sorted = r.detalles.sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime());
                console.log(`First Event Order: ${sorted[0].orden}`);
                console.log(`Last Event Order: ${sorted[sorted.length - 1].orden}`);
            }
        });
    }
}

debugDatos3();
