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
   * IMPORTANTE: Esta función debe adaptarse al formato específico del lector.
   *
   * Formatos comunes de lectores de rondines:
   * - Formato 1: "TAG,YYYY-MM-DD HH:MM:SS"
   * - Formato 2: "TAG TIMESTAMP" (timestamp Unix)
   * - Formato 3: Datos hexadecimales crudos
   *
   * Modificar esta función según la documentación del lector.
   */
  private procesarDatosLector(datos: string): void {
    logger.debug(`Datos recibidos: ${datos}`);

    try {
      // Limpiar datos
      const linea = datos.trim();
      if (!linea) return;

      // EJEMPLO: Formato "TAG,YYYY-MM-DD HH:MM:SS"
      // Ajustar según el formato real del lector
      const partes = linea.split(',');

      if (partes.length >= 2) {
        const tag = partes[0].trim().toUpperCase();
        const fechaHora = partes[1].trim();

        // Validar TAG (típicamente hexadecimal de 8-16 caracteres)
        if (/^[0-9A-F]{8,16}$/i.test(tag)) {
          const evento: EventoBuffer = {
            tag,
            fecha_hora: this.parsearFecha(fechaHora),
            datos_crudos: linea
          };

          this.buffer.push(evento);
          logger.info(`Evento registrado: TAG=${tag}, Fecha=${evento.fecha_hora}`);
        } else {
          logger.warn(`TAG inválido ignorado: ${tag}`);
        }
      } else {
        // Intentar parsear como formato alternativo
        this.procesarFormatoAlternativo(linea);
      }
    } catch (error: any) {
      logger.error(`Error procesando datos: ${error.message}`);
    }
  }

  /**
   * Parsear formatos alternativos de lectores
   */
  private procesarFormatoAlternativo(linea: string): void {
    // Formato: Solo TAG seguido de timestamp Unix
    const match = linea.match(/^([0-9A-Fa-f]{8,16})\s+(\d{10,13})$/);
    if (match) {
      const tag = match[1].toUpperCase();
      const timestamp = parseInt(match[2]);
      const fecha = timestamp > 9999999999
        ? new Date(timestamp) // milisegundos
        : new Date(timestamp * 1000); // segundos

      this.buffer.push({
        tag,
        fecha_hora: fecha.toISOString(),
        datos_crudos: linea
      });
      logger.info(`Evento registrado (alt): TAG=${tag}`);
      return;
    }

    // Formato: TAG hexadecimal solo (usar hora actual)
    const tagMatch = linea.match(/^([0-9A-Fa-f]{8,16})$/);
    if (tagMatch) {
      this.buffer.push({
        tag: tagMatch[1].toUpperCase(),
        fecha_hora: new Date().toISOString(),
        datos_crudos: linea
      });
      logger.info(`Evento registrado (tag-only): TAG=${tagMatch[1]}`);
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
