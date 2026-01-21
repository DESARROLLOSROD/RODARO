/**
 * Parser de datos del lector de rondines
 *
 * Formato detectado del lector:
 * - Header: "H YYYYMMDDHHmmss 00 CONTADOR"
 * - Eventos: "YYYYMMDDHHmmss 31 TAG_HEX_12"
 *
 * Ejemplo de datos:
 * H 20260121103926 00 27344
 * 20260114210613 31 00001437815B
 * 20260114210917 31 0000014FEC0B
 */

export interface EventoParsed {
  tag: string;
  fechaHora: Date;
  codigoLector: string;
  datosCrudos: string;
  valido: boolean;
  error?: string;
}

export interface HeaderDescarga {
  fechaDescarga: Date;
  totalEventos: number;
  datosCrudos: string;
}

/**
 * Parsea el header de descarga
 * Formato: "H YYYYMMDDHHmmss 00 CONTADOR"
 */
export function parsearHeader(linea: string): HeaderDescarga | null {
  const match = linea.match(/^H\s+(\d{14})\s+\d+\s+(\d+)$/);
  if (!match) return null;

  return {
    fechaDescarga: parsearFechaCompacta(match[1]),
    totalEventos: parseInt(match[2]),
    datosCrudos: linea
  };
}

/**
 * Parsea una línea de evento del lector
 * Formato: "YYYYMMDDHHmmss 31 TAG_HEX"
 */
export function parsearEvento(linea: string): EventoParsed {
  const resultado: EventoParsed = {
    tag: '',
    fechaHora: new Date(),
    codigoLector: '',
    datosCrudos: linea,
    valido: false
  };

  // Formato principal: "20260114210613 31 00001437815B"
  const match = linea.match(/^(\d{14})\s+(\d+)\s+([0-9A-Fa-f]{10,16})$/);

  if (!match) {
    resultado.error = 'Formato no reconocido';
    return resultado;
  }

  resultado.fechaHora = parsearFechaCompacta(match[1]);
  resultado.codigoLector = match[2];
  resultado.tag = match[3].toUpperCase();
  resultado.valido = validarTag(resultado.tag);

  if (!resultado.valido) {
    resultado.error = `TAG inválido: ${resultado.tag}`;
  }

  return resultado;
}

/**
 * Parsea fecha en formato compacto YYYYMMDDHHmmss
 */
export function parsearFechaCompacta(fechaStr: string): Date {
  const anio = parseInt(fechaStr.substring(0, 4));
  const mes = parseInt(fechaStr.substring(4, 6)) - 1;
  const dia = parseInt(fechaStr.substring(6, 8));
  const hora = parseInt(fechaStr.substring(8, 10));
  const minuto = parseInt(fechaStr.substring(10, 12));
  const segundo = parseInt(fechaStr.substring(12, 14));

  return new Date(anio, mes, dia, hora, minuto, segundo);
}

/**
 * Parsea un archivo completo de descarga
 */
export function parsearDescargaCompleta(contenido: string): {
  header: HeaderDescarga | null;
  eventos: EventoParsed[];
  errores: string[];
} {
  const lineas = contenido.split('\n').map(l => l.trim()).filter(l => l);
  const resultado = {
    header: null as HeaderDescarga | null,
    eventos: [] as EventoParsed[],
    errores: [] as string[]
  };

  for (const linea of lineas) {
    // Verificar si es header
    if (linea.startsWith('H ')) {
      resultado.header = parsearHeader(linea);
      continue;
    }

    // Parsear evento
    const evento = parsearEvento(linea);
    if (evento.valido) {
      resultado.eventos.push(evento);
    } else if (evento.error) {
      resultado.errores.push(`Línea: "${linea}" - ${evento.error}`);
    }
  }

  return resultado;
}

/**
 * Parsea formato CSV legacy: "TAG,YYYY-MM-DD HH:MM:SS"
 */
export function parsearFormatoCSV(linea: string): EventoParsed {
  const resultado: EventoParsed = {
    tag: '',
    fechaHora: new Date(),
    codigoLector: '',
    datosCrudos: linea,
    valido: false
  };

  try {
    const partes = linea.split(',');
    if (partes.length < 2) {
      resultado.error = 'Formato inválido: se esperaba TAG,FECHA';
      return resultado;
    }

    resultado.tag = partes[0].trim().toUpperCase();
    const fechaStr = partes.slice(1).join(',').trim();

    // Validar TAG
    if (!validarTag(resultado.tag)) {
      resultado.error = `TAG inválido: ${resultado.tag}`;
      return resultado;
    }

    // Parsear fecha
    const fecha = parsearFecha(fechaStr);
    if (!fecha) {
      resultado.error = `Fecha inválida: ${fechaStr}`;
      return resultado;
    }

    resultado.fechaHora = fecha;
    resultado.valido = true;
    return resultado;

  } catch (error: any) {
    resultado.error = `Error de parsing: ${error.message}`;
    return resultado;
  }
}

/**
 * Parsea formato hexadecimal puro
 * Ejemplo: Lectores que envían datos en formato HEX
 */
export function parsearFormatoHex(datos: Buffer): EventoParsed[] {
  const eventos: EventoParsed[] = [];

  // Ejemplo de estructura de paquete (ajustar según protocolo):
  // [STX] [TAG 8 bytes] [TIMESTAMP 4 bytes] [ETX]
  // STX = 0x02, ETX = 0x03

  let offset = 0;
  while (offset < datos.length) {
    // Buscar inicio de paquete
    if (datos[offset] !== 0x02) {
      offset++;
      continue;
    }

    // Verificar que hay suficientes bytes
    if (offset + 13 > datos.length) break;

    // Leer TAG (8 bytes hex)
    const tagBytes = datos.slice(offset + 1, offset + 9);
    const tag = tagBytes.toString('hex').toUpperCase();

    // Leer timestamp (4 bytes, little-endian)
    const timestamp = datos.readUInt32LE(offset + 9);
    const fecha = new Date(timestamp * 1000);

    // Verificar ETX
    if (datos[offset + 13] === 0x03) {
      eventos.push({
        tag,
        fechaHora: fecha,
        datosCrudos: datos.slice(offset, offset + 14).toString('hex'),
        valido: validarTag(tag)
      });
    }

    offset += 14;
  }

  return eventos;
}

/**
 * Parsea formato con timestamp Unix
 * Ejemplo: "A1B2C3D4 1703505600"
 */
export function parsearFormatoTimestamp(linea: string): EventoParsed {
  const resultado: EventoParsed = {
    tag: '',
    fechaHora: new Date(),
    datosCrudos: linea,
    valido: false
  };

  const match = linea.match(/^([0-9A-Fa-f]{8,16})\s+(\d{10,13})$/);
  if (!match) {
    resultado.error = 'Formato no coincide con TAG TIMESTAMP';
    return resultado;
  }

  resultado.tag = match[1].toUpperCase();
  const timestamp = parseInt(match[2]);

  // Determinar si es segundos o milisegundos
  if (timestamp > 9999999999) {
    resultado.fechaHora = new Date(timestamp);
  } else {
    resultado.fechaHora = new Date(timestamp * 1000);
  }

  if (!validarTag(resultado.tag)) {
    resultado.error = `TAG inválido: ${resultado.tag}`;
    return resultado;
  }

  resultado.valido = true;
  return resultado;
}

/**
 * Valida que un TAG tenga formato correcto (hexadecimal)
 */
export function validarTag(tag: string): boolean {
  // TAGs típicamente son hexadecimales de 8-16 caracteres
  return /^[0-9A-Fa-f]{8,16}$/.test(tag);
}

/**
 * Normaliza un TAG (mayúsculas, sin espacios)
 */
export function normalizarTag(tag: string): string {
  return tag.toUpperCase().replace(/\s+/g, '');
}

/**
 * Parsea fecha en varios formatos comunes
 */
export function parsearFecha(fechaStr: string): Date | null {
  // Formato ISO
  let fecha = new Date(fechaStr);
  if (!isNaN(fecha.getTime())) {
    return fecha;
  }

  // Formato DD/MM/YYYY HH:MM:SS
  let match = fechaStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, dia, mes, anio, hora, min, seg] = match;
    return new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia),
                    parseInt(hora), parseInt(min), parseInt(seg));
  }

  // Formato DD-MM-YYYY HH:MM:SS
  match = fechaStr.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, dia, mes, anio, hora, min, seg] = match;
    return new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia),
                    parseInt(hora), parseInt(min), parseInt(seg));
  }

  // Formato YYYYMMDDHHMMSS
  match = fechaStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (match) {
    const [, anio, mes, dia, hora, min, seg] = match;
    return new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia),
                    parseInt(hora), parseInt(min), parseInt(seg));
  }

  return null;
}

/**
 * Detecta automáticamente el formato de los datos
 */
export function detectarFormato(datos: string): 'csv' | 'timestamp' | 'hex' | 'desconocido' {
  // CSV: contiene coma y parece tener fecha
  if (datos.includes(',') && /\d{4}/.test(datos)) {
    return 'csv';
  }

  // Timestamp: TAG seguido de número grande
  if (/^[0-9A-Fa-f]{8,16}\s+\d{10,13}$/.test(datos.trim())) {
    return 'timestamp';
  }

  // Hex: solo caracteres hexadecimales
  if (/^[0-9A-Fa-f]+$/.test(datos.trim())) {
    return 'hex';
  }

  return 'desconocido';
}
