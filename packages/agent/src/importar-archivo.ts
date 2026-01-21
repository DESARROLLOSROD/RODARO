/**
 * Utilidad para importar archivos de descarga históricos
 *
 * Uso: npx tsx src/importar-archivo.ts <ruta-archivo>
 *
 * Lee un archivo de descarga del lector y lo envía al servidor
 */

import * as fs from 'fs';
import * as path from 'path';
import { parsearDescargaCompleta } from './services/parser';
import { ApiService } from './services/api';
import { loadConfig } from './utils/config';
import { logger } from './utils/logger';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Uso: npx tsx src/importar-archivo.ts <ruta-archivo>');
    console.log('');
    console.log('Ejemplo:');
    console.log('  npx tsx src/importar-archivo.ts descarga_20260121.txt');
    process.exit(1);
  }

  const archivoRuta = args[0];

  if (!fs.existsSync(archivoRuta)) {
    console.error(`Error: Archivo no encontrado: ${archivoRuta}`);
    process.exit(1);
  }

  logger.info('='.repeat(50));
  logger.info('Importador de Archivos de Descarga');
  logger.info('='.repeat(50));

  try {
    // Cargar configuración
    const config = loadConfig();
    const apiService = new ApiService(config.api.url, config.api.token);

    // Verificar conexión
    logger.info('Verificando conexión con el servidor...');
    const apiOk = await apiService.healthCheck();
    if (!apiOk) {
      logger.error('No se pudo conectar con el servidor API');
      process.exit(1);
    }
    logger.info('Conexión OK');

    // Leer archivo
    logger.info(`Leyendo archivo: ${archivoRuta}`);
    const contenido = fs.readFileSync(archivoRuta, 'utf-8');

    // Parsear
    logger.info('Parseando datos...');
    const resultado = parsearDescargaCompleta(contenido);

    if (resultado.header) {
      logger.info(`Header encontrado: ${resultado.header.totalEventos} eventos en descarga original`);
    }

    logger.info(`Eventos válidos encontrados: ${resultado.eventos.length}`);

    if (resultado.errores.length > 0) {
      logger.warn(`Errores de parsing: ${resultado.errores.length}`);
      resultado.errores.slice(0, 5).forEach(e => logger.warn(`  - ${e}`));
      if (resultado.errores.length > 5) {
        logger.warn(`  ... y ${resultado.errores.length - 5} más`);
      }
    }

    if (resultado.eventos.length === 0) {
      logger.warn('No hay eventos para enviar');
      process.exit(0);
    }

    // Preparar payload
    const payload = {
      lector_id: `IMPORT_${path.basename(archivoRuta)}`,
      eventos: resultado.eventos.map(e => ({
        tag: e.tag,
        fecha_hora: e.fechaHora.toISOString(),
        datos_crudos: e.datosCrudos
      })),
      timestamp_descarga: new Date().toISOString()
    };

    // Enviar en lotes de 500
    const BATCH_SIZE = 500;
    let totalEnviados = 0;
    let totalNuevos = 0;
    let totalDuplicados = 0;

    for (let i = 0; i < payload.eventos.length; i += BATCH_SIZE) {
      const batch = payload.eventos.slice(i, i + BATCH_SIZE);
      logger.info(`Enviando lote ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} eventos)...`);

      const batchPayload = {
        ...payload,
        eventos: batch
      };

      const respuesta = await apiService.enviarDescarga(batchPayload);

      if (respuesta.success) {
        totalEnviados += batch.length;
        totalNuevos += respuesta.procesados || 0;
        totalDuplicados += respuesta.duplicados || 0;
        logger.info(`  Procesados: ${respuesta.procesados}, Duplicados: ${respuesta.duplicados}`);
      } else {
        logger.error(`  Error: ${respuesta.message}`);
      }

      // Pequeña pausa entre lotes
      if (i + BATCH_SIZE < payload.eventos.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    logger.info('='.repeat(50));
    logger.info('Resumen de importación:');
    logger.info(`  Total en archivo: ${resultado.eventos.length}`);
    logger.info(`  Enviados: ${totalEnviados}`);
    logger.info(`  Nuevos: ${totalNuevos}`);
    logger.info(`  Duplicados: ${totalDuplicados}`);
    logger.info('='.repeat(50));

  } catch (error: any) {
    logger.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
