
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
