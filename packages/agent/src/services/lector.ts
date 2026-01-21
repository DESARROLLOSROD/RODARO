import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { logger } from '../utils/logger';
import { ApiService } from './api';
import { Config } from '../utils/config';

interface EventoBuffer {
  tag: string;
  fecha_hora: string;
  datos_crudos: string;
}

export class LectorService {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private config: Config['lector'];
  private apiService: ApiService;
  private buffer: EventoBuffer[] = [];
  private conectado: boolean = false;
  private lectorId: string;

  constructor(config: Config['lector'], apiService: ApiService) {
    this.config = config;
    this.apiService = apiService;
    this.lectorId = `LECTOR_${config.puerto.replace('COM', '')}`;
  }

  async iniciar(): Promise<void> {
    logger.info(`Intentando conectar al lector en ${this.config.puerto}...`);

    // Listar puertos disponibles
    try {
      const puertos = await SerialPort.list();
      logger.info('Puertos COM disponibles:');
      puertos.forEach(p => {
        logger.info(`  - ${p.path}: ${p.manufacturer || 'Sin fabricante'}`);
      });
    } catch (error) {
      logger.warn('No se pudieron listar los puertos COM');
    }

    return new Promise((resolve, reject) => {
      try {
        this.port = new SerialPort({
          path: this.config.puerto,
          baudRate: this.config.baudRate,
          dataBits: this.config.dataBits as 5 | 6 | 7 | 8,
          stopBits: this.config.stopBits as 1 | 2,
          parity: this.config.parity,
          autoOpen: false
        });

        this.port.open((err) => {
          if (err) {
            logger.error(`Error abriendo puerto ${this.config.puerto}: ${err.message}`);
            this.conectado = false;
            // No rechazar, intentar modo simulación
            logger.warn('Ejecutando en modo simulación (sin lector físico)');
            resolve();
            return;
          }

          logger.info(`Puerto ${this.config.puerto} abierto correctamente`);
          this.conectado = true;
          this.configurarParser();
          resolve();
        });

        this.port.on('error', (err) => {
          logger.error(`Error en puerto serial: ${err.message}`);
          this.conectado = false;
        });

        this.port.on('close', () => {
          logger.warn('Puerto serial cerrado');
          this.conectado = false;
        });

      } catch (error: any) {
        logger.error(`Error inicializando puerto: ${error.message}`);
        logger.warn('Ejecutando en modo simulación (sin lector físico)');
        resolve();
      }
    });
  }

  private configurarParser(): void {
    if (!this.port) return;

    // Parser de línea - ajustar según el protocolo del lector
    this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    this.parser.on('data', (data: string) => {
      this.procesarDatosLector(data);
    });
  }

  /**
   * Procesa los datos recibidos del lector.
   *
   * Formato detectado del lector:
   * - Header: "H YYYYMMDDHHmmss 00 CONTADOR"
   * - Eventos: "YYYYMMDDHHmmss 31 TAG_HEX_12"
   *
   * Ejemplo:
   * H 20260121103926 00 27344
   * 20260114210613 31 00001437815B
   */
  private procesarDatosLector(datos: string): void {
    logger.debug(`Datos recibidos: ${datos}`);

    try {
      const linea = datos.trim();
      if (!linea) return;

      // Ignorar línea de header (empieza con H)
      if (linea.startsWith('H ')) {
        const headerMatch = linea.match(/^H\s+(\d{14})\s+\d+\s+(\d+)$/);
        if (headerMatch) {
          logger.info(`Header de descarga: Fecha=${headerMatch[1]}, Total eventos=${headerMatch[2]}`);
        }
        return;
      }

      // Formato principal: "YYYYMMDDHHmmss 31 TAG_HEX"
      // Ejemplo: "20260114210613 31 00001437815B"
      const match = linea.match(/^(\d{14})\s+(\d+)\s+([0-9A-Fa-f]{10,16})$/);

      if (match) {
        const fechaStr = match[1]; // YYYYMMDDHHmmss
        const codigoLector = match[2]; // 31
        const tag = match[3].toUpperCase();

        // Parsear fecha YYYYMMDDHHmmss
        const fecha = this.parsearFechaCompacta(fechaStr);

        const evento: EventoBuffer = {
          tag,
          fecha_hora: fecha.toISOString(),
          datos_crudos: linea
        };

        this.buffer.push(evento);
        logger.info(`Evento: TAG=${tag}, Fecha=${fecha.toLocaleString()}, Lector=${codigoLector}`);
      } else {
        // Intentar formato alternativo
        this.procesarFormatoAlternativo(linea);
      }
    } catch (error: any) {
      logger.error(`Error procesando datos: ${error.message}`);
    }
  }

  /**
   * Parsea fecha en formato compacto YYYYMMDDHHmmss
   */
  private parsearFechaCompacta(fechaStr: string): Date {
    // fechaStr = "20260114210613"
    const anio = parseInt(fechaStr.substring(0, 4));
    const mes = parseInt(fechaStr.substring(4, 6)) - 1; // Meses 0-11
    const dia = parseInt(fechaStr.substring(6, 8));
    const hora = parseInt(fechaStr.substring(8, 10));
    const minuto = parseInt(fechaStr.substring(10, 12));
    const segundo = parseInt(fechaStr.substring(12, 14));

    return new Date(anio, mes, dia, hora, minuto, segundo);
  }

  /**
   * Parsear formatos alternativos de lectores
   */
  private procesarFormatoAlternativo(linea: string): void {
    // Formato alternativo: "YYYYMMDDHHmmss TAG" (sin código de lector)
    const altMatch = linea.match(/^(\d{14})\s+([0-9A-Fa-f]{10,16})$/);
    if (altMatch) {
      const fecha = this.parsearFechaCompacta(altMatch[1]);
      const tag = altMatch[2].toUpperCase();

      this.buffer.push({
        tag,
        fecha_hora: fecha.toISOString(),
        datos_crudos: linea
      });
      logger.info(`Evento (alt): TAG=${tag}`);
      return;
    }

    // Formato: Solo TAG seguido de timestamp Unix
    const unixMatch = linea.match(/^([0-9A-Fa-f]{8,16})\s+(\d{10,13})$/);
    if (unixMatch) {
      const tag = unixMatch[1].toUpperCase();
      const timestamp = parseInt(unixMatch[2]);
      const fecha = timestamp > 9999999999
        ? new Date(timestamp) // milisegundos
        : new Date(timestamp * 1000); // segundos

      this.buffer.push({
        tag,
        fecha_hora: fecha.toISOString(),
        datos_crudos: linea
      });
      logger.info(`Evento (unix): TAG=${tag}`);
      return;
    }

    // Formato: TAG hexadecimal solo (usar hora actual)
    const tagMatch = linea.match(/^([0-9A-Fa-f]{10,16})$/);
    if (tagMatch) {
      this.buffer.push({
        tag: tagMatch[1].toUpperCase(),
        fecha_hora: new Date().toISOString(),
        datos_crudos: linea
      });
      logger.info(`Evento (tag-only): TAG=${tagMatch[1]}`);
      return;
    }

    logger.debug(`Línea no reconocida: ${linea}`);
  }

  private parsearFecha(fechaStr: string): string {
    try {
      // Intentar parsear varios formatos comunes
      const fecha = new Date(fechaStr);
      if (!isNaN(fecha.getTime())) {
        return fecha.toISOString();
      }

      // Formato DD/MM/YYYY HH:MM:SS
      const match = fechaStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        const [, dia, mes, anio, hora, min, seg] = match;
        return new Date(`${anio}-${mes}-${dia}T${hora}:${min}:${seg}`).toISOString();
      }

      // Si no se puede parsear, usar fecha actual
      logger.warn(`No se pudo parsear fecha: ${fechaStr}, usando fecha actual`);
      return new Date().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  async descargarYEnviar(): Promise<void> {
    // Si hay eventos en el buffer, enviarlos
    if (this.buffer.length > 0) {
      logger.info(`Enviando ${this.buffer.length} eventos al servidor...`);

      const payload = {
        lector_id: this.lectorId,
        eventos: this.buffer.map(e => ({
          tag: e.tag,
          fecha_hora: e.fecha_hora,
          datos_crudos: e.datos_crudos
        })),
        timestamp_descarga: new Date().toISOString()
      };

      const resultado = await this.apiService.enviarDescarga(payload);

      if (resultado.success) {
        logger.info(`Descarga exitosa: ${resultado.procesados} nuevos, ${resultado.duplicados || 0} duplicados`);
        if (resultado.rondas_afectadas) {
          logger.info(`Rondas afectadas: ${resultado.rondas_afectadas}`);
        }
        // Limpiar buffer solo si la descarga fue exitosa
        this.buffer = [];
      } else {
        logger.error(`Error en descarga: ${resultado.message}`);
        // Mantener buffer para reintentar
      }
    } else {
      logger.debug('Sin eventos para enviar');
    }

    // Enviar comando de descarga al lector si está conectado
    if (this.conectado && this.port) {
      this.enviarComandoDescarga();
    }
  }

  /**
   * Envía comando de descarga al lector.
   * IMPORTANTE: El comando varía según el modelo del lector.
   * Ajustar según la documentación del fabricante.
   */
  private enviarComandoDescarga(): void {
    if (!this.port || !this.conectado) return;

    // Ejemplo de comandos comunes (ajustar según el lector específico):
    // - "D" o "DOWNLOAD" para iniciar descarga
    // - Secuencia hexadecimal específica del fabricante
    // - ACK/NAK protocol

    const comando = 'D\r\n'; // Ajustar según protocolo del lector

    this.port.write(comando, (err) => {
      if (err) {
        logger.error(`Error enviando comando de descarga: ${err.message}`);
      } else {
        logger.debug('Comando de descarga enviado');
      }
    });
  }

  async detener(): Promise<void> {
    if (this.port && this.port.isOpen) {
      return new Promise((resolve) => {
        this.port!.close((err) => {
          if (err) {
            logger.error(`Error cerrando puerto: ${err.message}`);
          } else {
            logger.info('Puerto serial cerrado correctamente');
          }
          resolve();
        });
      });
    }
  }

  getEstado(): { conectado: boolean; eventosEnBuffer: number } {
    return {
      conectado: this.conectado,
      eventosEnBuffer: this.buffer.length
    };
  }
}
