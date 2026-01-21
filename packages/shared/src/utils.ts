// ============================================
// UTILIDADES COMPARTIDAS
// ============================================

import { EstatusRonda, EstatusDetalle } from './types';

/**
 * Calcula las ventanas de ronda esperadas para un turno
 */
export function calcularVentanasRonda(
  inicioTurno: Date,
  finTurno: Date,
  frecuenciaMinutos: number
): { inicio: Date; fin: Date }[] {
  const ventanas: { inicio: Date; fin: Date }[] = [];
  let ventanaInicio = new Date(inicioTurno);

  while (ventanaInicio < finTurno) {
    const ventanaFin = new Date(ventanaInicio.getTime() + frecuenciaMinutos * 60 * 1000);

    ventanas.push({
      inicio: new Date(ventanaInicio),
      fin: ventanaFin > finTurno ? new Date(finTurno) : ventanaFin
    });

    ventanaInicio = ventanaFin;
  }

  return ventanas;
}

/**
 * Determina si una fecha está dentro de una ventana de tiempo
 */
export function estaEnVentana(
  fecha: Date,
  ventanaInicio: Date,
  ventanaFin: Date
): boolean {
  return fecha >= ventanaInicio && fecha <= ventanaFin;
}

/**
 * Calcula la diferencia en segundos entre dos fechas
 */
export function diferenciaSegundos(fecha1: Date, fecha2: Date): number {
  return Math.round((fecha1.getTime() - fecha2.getTime()) / 1000);
}

/**
 * Determina el estatus de un detalle de ronda basado en la tolerancia
 */
export function determinarEstatusDetalle(
  diferenciaSeg: number | null,
  toleranciaSeg: number
): EstatusDetalle {
  if (diferenciaSeg === null) {
    return EstatusDetalle.OMITIDO;
  }

  if (Math.abs(diferenciaSeg) <= toleranciaSeg) {
    return EstatusDetalle.A_TIEMPO;
  }

  return EstatusDetalle.RETRASADO;
}

/**
 * Formatea una fecha para mostrar en la UI
 */
export function formatearFecha(fecha: Date | string, incluirHora = true): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;

  const opciones: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  };

  if (incluirHora) {
    opciones.hour = '2-digit';
    opciones.minute = '2-digit';
    opciones.second = '2-digit';
  }

  return d.toLocaleDateString('es-MX', opciones);
}

/**
 * Formatea duración en segundos a formato legible
 */
export function formatearDuracion(segundos: number): string {
  const abs = Math.abs(segundos);
  const signo = segundos < 0 ? '-' : '+';

  if (abs < 60) {
    return `${signo}${abs}s`;
  }

  const minutos = Math.floor(abs / 60);
  const seg = abs % 60;

  if (minutos < 60) {
    return `${signo}${minutos}m ${seg}s`;
  }

  const horas = Math.floor(minutos / 60);
  const min = minutos % 60;

  return `${signo}${horas}h ${min}m`;
}

/**
 * Genera un ID único (para uso temporal, Supabase genera UUIDs)
 */
export function generarId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Valida formato de TAG (hexadecimal típicamente)
 */
export function validarFormatoTag(tag: string): boolean {
  // TAGs típicamente son hexadecimales de 8-16 caracteres
  return /^[0-9A-Fa-f]{8,16}$/.test(tag);
}

/**
 * Normaliza un TAG (mayúsculas, sin espacios)
 */
export function normalizarTag(tag: string): string {
  return tag.toUpperCase().replace(/\s/g, '');
}

/**
 * Calcula el porcentaje de cumplimiento
 */
export function calcularCumplimiento(
  completas: number,
  total: number
): number {
  if (total === 0) return 0;
  return Math.round((completas / total) * 100);
}

/**
 * Agrupa elementos por una clave
 */
export function agruparPor<T>(
  items: T[],
  keyFn: (item: T) => string
): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

/**
 * Parsea fecha ISO a Date
 */
export function parsearFechaISO(fecha: string): Date {
  return new Date(fecha);
}

/**
 * Convierte Date a formato ISO
 */
export function aFormatoISO(fecha: Date): string {
  return fecha.toISOString();
}

/**
 * Obtiene el inicio del día para una fecha
 */
export function inicioDelDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Obtiene el fin del día para una fecha
 */
export function finDelDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Valida que la secuencia de estaciones sea correcta
 * (inicia en E1, termina en E1, orden consecutivo)
 */
export function validarSecuenciaEstaciones(
  ordenes: number[],
  totalEstaciones: number
): { valido: boolean; error?: string } {
  if (ordenes.length === 0) {
    return { valido: false, error: 'No hay estaciones registradas' };
  }

  // Debe iniciar en estación 1
  if (ordenes[0] !== 1) {
    return { valido: false, error: 'La ronda no inicia en Estación 1' };
  }

  // Debe terminar en estación 1
  if (ordenes[ordenes.length - 1] !== 1) {
    return { valido: false, error: 'La ronda no termina en Estación 1' };
  }

  // Verificar secuencia (simplificado)
  // En una implementación completa, verificar el orden específico

  return { valido: true };
}
