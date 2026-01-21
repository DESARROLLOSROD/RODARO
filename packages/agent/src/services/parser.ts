/**
 * Parser de datos del lector de rondines
 *
 * Este archivo contiene funciones para parsear diferentes formatos
 * de datos de lectores de rondines/TAGs.
 *
 * IMPORTANTE: Ajustar estas funciones según el protocolo específico
 * del lector que se esté utilizando.
 */

export interface EventoParsed {
  tag: string;
  fechaHora: Date;
  datosCrudos: string;
  valido: boolean;
  error?: string;
}

/**
 * Parsea formato estándar: "TAG,YYYY-MM-DD HH:MM:SS"
 */
export function parsearFormatoCSV(linea: string): EventoParsed {
  const resultado: EventoParsed = {
    tag: '',
    fechaHora: new Date(),
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
