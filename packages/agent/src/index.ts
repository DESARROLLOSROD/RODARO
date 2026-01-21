import { LectorService } from './services/lector';
import { ApiService } from './services/api';
import { logger } from './utils/logger';
import { loadConfig } from './utils/config';

async function main() {
  logger.info('='.repeat(50));
  logger.info('Iniciando Agente de Rondines');
  logger.info('='.repeat(50));

  try {
    const config = loadConfig();

    const apiService = new ApiService(config.api.url, config.api.token);
    const lectorService = new LectorService(config.lector, apiService);

    // Verificar conexión con API
    logger.info('Verificando conexión con el servidor...');
    const apiOk = await apiService.healthCheck();
    if (!apiOk) {
      logger.error('No se pudo conectar con el servidor API');
      process.exit(1);
    }
    logger.info('Conexión con servidor OK');

    // Iniciar servicio de lector
    await lectorService.iniciar();

    // Configurar intervalo de descarga
    const intervaloMs = config.intervalo.descargaSegundos * 1000;
    logger.info(`Intervalo de descarga: ${config.intervalo.descargaSegundos} segundos`);

    setInterval(async () => {
      try {
        await lectorService.descargarYEnviar();
      } catch (error) {
        logger.error('Error en ciclo de descarga:', error);
      }
    }, intervaloMs);

    // Primera descarga inmediata
    await lectorService.descargarYEnviar();

    // Mantener el proceso vivo
    logger.info('Agente ejecutándose. Presiona Ctrl+C para detener.');

    // Manejar cierre graceful
    process.on('SIGINT', async () => {
      logger.info('Deteniendo agente...');
      await lectorService.detener();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Deteniendo agente...');
      await lectorService.detener();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Error fatal:', error);
    process.exit(1);
  }
}

main();
