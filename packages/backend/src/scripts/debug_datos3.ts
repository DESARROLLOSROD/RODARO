
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { procesarEventos } from '../services/motorRondas';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function debugDatos3() {
    console.log('=== DEBUGGING DATOS3.txt ===');

    const content = fs.readFileSync(path.resolve(__dirname, '../../../../DATOS3.txt'), 'utf-8');

    const lines = content.split('\n').map(l => l.trim()).filter(l => l);
    const eventos: any[] = [];

    for (const linea of lines) {
        if (linea.startsWith('H ')) continue;
        // Format: YYYYMMDDHHmmss 31 TAG
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

    const eventosDia1 = eventos.filter(e => e.fecha_hora.startsWith('2026-01-14'));
    console.log(`Eventos Dia 14: ${eventosDia1.length}`);

    const resultado = await procesarEventos(eventosDia1);
    console.log('Resultado Procesamiento:', resultado);

    // Query Generated Rounds
    const { data: rondas } = await supabase
        .from('rondas')
        .select('*, detalles:ronda_detalle(*)')
        .gte('inicio', '2026-01-14T00:00:00Z')
        .lte('inicio', '2026-01-14T23:59:59Z');

    if (rondas) {
        (rondas as any[]).forEach(r => {
            console.log(`\nRonda ID: ${r.id}`);
            console.log(`Estatus: ${r.estatus}`);
            console.log(`Inicio: ${r.inicio}`);
            console.log(`Fin: ${r.fin}`);
            console.log(`Detalles Count: ${r.detalles.length}`);

            // Verify Start/End details
            if (r.detalles.length > 0) {
                const sorted = r.detalles.sort((a: any, b: any) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime());
                console.log(`First Event Order: ${sorted[0].orden}`);
                console.log(`Last Event Order: ${sorted[sorted.length - 1].orden}`);
            }
        });
    }
}

debugDatos3();
