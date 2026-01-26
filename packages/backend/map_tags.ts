
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function mapTags() {
    const { data: estaciones } = await supabase
        .from('estaciones')
        .select('orden, nombre, tag')
        .order('orden', { ascending: true });

    console.log('--- MAPA DE ESTACIONES ---');
    if (estaciones) {
        estaciones.forEach(e => {
            console.log(`Orden ${e.orden}: [${e.tag}] ${e.nombre}`);
        });
    }
}

mapTags();
