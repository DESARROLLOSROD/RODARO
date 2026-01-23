require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: estaciones } = await supabase
    .from('estaciones')
    .select('orden, nombre, tiempo_esperado_seg, tolerancia_seg, ruta:rutas(nombre)')
    .eq('activa', true)
    .order('orden');

  console.log('=== CONFIGURACION DE ESTACIONES ===\n');
  estaciones.forEach(e => {
    console.log('Orden ' + e.orden + ': ' + e.nombre);
    console.log('  Tiempo esperado: ' + e.tiempo_esperado_seg + 's | Tolerancia: ' + e.tolerancia_seg + 's');
    console.log('');
  });
}
main();
