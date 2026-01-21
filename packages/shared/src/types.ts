// ============================================
// TIPOS DEL SISTEMA DE RONDINES
// ============================================

// --- Enums ---

export enum EstatusRonda {
  COMPLETA = 'COMPLETA',
  INCOMPLETA = 'INCOMPLETA',
  INVALIDA = 'INVALIDA',
  NO_REALIZADA = 'NO_REALIZADA'
}

export enum EstatusDetalle {
  A_TIEMPO = 'A_TIEMPO',
  RETRASADO = 'RETRASADO',
  OMITIDO = 'OMITIDO'
}

export enum RolUsuario {
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  OPERADOR = 'OPERADOR'
}

// --- Entidades Base ---

export interface Vigilante {
  id: string;
  nombre: string;
  numero_empleado?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Turno {
  id: string;
  vigilante_id: string;
  ruta_id: string;
  inicio: string; // ISO datetime
  fin: string; // ISO datetime
  created_at: string;
}

export interface Ruta {
  id: string;
  nombre: string;
  descripcion?: string;
  frecuencia_min: number; // 120 o 180 minutos típicamente
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Estacion {
  id: string;
  ruta_id: string;
  nombre: string;
  tag: string; // Identificador del TAG físico
  orden: number;
  tiempo_esperado_seg: number;
  tolerancia_seg: number;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Evento {
  id: string;
  tag: string;
  fecha_hora: string; // ISO datetime
  lector_id?: string;
  datos_crudos?: string;
  procesado: boolean;
  created_at: string;
}

export interface Ronda {
  id: string;
  ruta_id: string;
  turno_id: string;
  vigilante_id: string;
  inicio: string; // ISO datetime
  fin?: string; // ISO datetime
  estatus: EstatusRonda;
  ventana_inicio: string; // Inicio de la ventana esperada
  ventana_fin: string; // Fin de la ventana esperada
  observaciones?: string;
  created_at: string;
  updated_at: string;
}

export interface RondaDetalle {
  id: string;
  ronda_id: string;
  estacion_id: string;
  evento_id?: string;
  orden: number;
  fecha_hora?: string;
  diferencia_seg?: number; // Diferencia vs tiempo esperado
  estatus: EstatusDetalle;
  created_at: string;
}

// --- DTOs y Request/Response ---

export interface EventoCrudoDTO {
  tag: string;
  fecha_hora: string;
  lector_id?: string;
  datos_crudos?: string;
}

export interface DescargaLectorDTO {
  lector_id: string;
  eventos: EventoCrudoDTO[];
  timestamp_descarga: string;
}

export interface CrearRutaDTO {
  nombre: string;
  descripcion?: string;
  frecuencia_min: number;
  estaciones: Omit<Estacion, 'id' | 'ruta_id' | 'created_at' | 'updated_at'>[];
}

export interface CrearTurnoDTO {
  vigilante_id: string;
  ruta_id: string;
  inicio: string;
  fin: string;
}

export interface CrearVigilanteDTO {
  nombre: string;
  numero_empleado?: string;
}

// --- Reportes ---

export interface ReporteRonda {
  ronda: Ronda;
  vigilante: Vigilante;
  ruta: Ruta;
  detalles: (RondaDetalle & { estacion: Estacion })[];
}

export interface ResumenTurno {
  turno: Turno;
  vigilante: Vigilante;
  ruta: Ruta;
  total_rondas_esperadas: number;
  rondas_completas: number;
  rondas_incompletas: number;
  rondas_invalidas: number;
  rondas_no_realizadas: number;
  porcentaje_cumplimiento: number;
}

export interface ResumenDiario {
  fecha: string;
  turnos: ResumenTurno[];
  total_rondas: number;
  cumplimiento_general: number;
}

// --- Respuestas API ---

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// --- Configuración ---

export interface ConfiguracionLector {
  id: string;
  nombre: string;
  puerto_com: string;
  baudrate: number;
  activo: boolean;
}

export interface ConfiguracionAgente {
  api_url: string;
  api_token: string;
  intervalo_descarga_seg: number;
  lectores: ConfiguracionLector[];
}
