import { supabase } from '../config/supabase';

async function checkDetails() {
    const { data, error } = await supabase
        .from('ronda_detalle')
        .select('*, estaciones(nombre, tiempo_esperado_seg)')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error(error);
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

checkDetails();
