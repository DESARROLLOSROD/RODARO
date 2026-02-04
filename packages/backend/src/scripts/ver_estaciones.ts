import { supabase } from '../config/supabase';

async function main() {
  const { data: estaciones } = await supabase
    .from('estaciones')
    .select('orden, nombre, tiempo_esperado_seg, tolerancia_seg, ruta:rutas(nombre)')
    .eq('activa', true)
    .order('orden');

  console.log('=== CONFIGURACION DE ESTACIONES ===\n');
  (estaciones as any[])?.forEach(e => {
    console.log('Orden ' + e.orden + ': ' + e.nombre);
    console.log('  Tiempo esperado: ' + e.tiempo_esperado_seg + 's | Tolerancia: ' + e.tolerancia_seg + 's');
    console.log('');
  });
}
main();
