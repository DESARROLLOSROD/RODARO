// ============================================
// CONSTANTES DEL SISTEMA DE RONDINES
// ============================================

// Frecuencias de ronda en minutos
export const FRECUENCIA_RONDA = {
  DOS_HORAS: 120,
  TRES_HORAS: 180
} as const;

// Duración de turno 24x48 en horas
export const DURACION_TURNO_HORAS = 24;

// Tolerancias por defecto (en segundos)
export const TOLERANCIAS = {
  LLEGADA_ESTACION: 300, // 5 minutos
  INICIO_RONDA: 600, // 10 minutos
  FIN_RONDA: 600 // 10 minutos
} as const;

// Configuración de puerto serial por defecto
export const SERIAL_CONFIG = {
  BAUDRATE: 9600,
  DATA_BITS: 8,
  STOP_BITS: 1,
  PARITY: 'none'
} as const;

// Estados de conexión del agente
export const ESTADO_AGENTE = {
  CONECTADO: 'CONECTADO',
  DESCONECTADO: 'DESCONECTADO',
  DESCARGANDO: 'DESCARGANDO',
  ERROR: 'ERROR'
} as const;

// Códigos de error
export const ERROR_CODES = {
  // Errores de autenticación
  AUTH_INVALID_TOKEN: 'AUTH_001',
  AUTH_EXPIRED_TOKEN: 'AUTH_002',
  AUTH_MISSING_TOKEN: 'AUTH_003',

  // Errores de validación
  VALIDATION_REQUIRED_FIELD: 'VAL_001',
  VALIDATION_INVALID_FORMAT: 'VAL_002',
  VALIDATION_OUT_OF_RANGE: 'VAL_003',

  // Errores de negocio
  RONDA_DUPLICADA: 'BUS_001',
  TURNO_SOLAPADO: 'BUS_002',
  ESTACION_NO_ENCONTRADA: 'BUS_003',
  TAG_NO_REGISTRADO: 'BUS_004',

  // Errores de sistema
  DATABASE_ERROR: 'SYS_001',
  SERIAL_PORT_ERROR: 'SYS_002',
  NETWORK_ERROR: 'SYS_003'
} as const;

// Mensajes de error en español
export const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.AUTH_INVALID_TOKEN]: 'Token de autenticación inválido',
  [ERROR_CODES.AUTH_EXPIRED_TOKEN]: 'Token de autenticación expirado',
  [ERROR_CODES.AUTH_MISSING_TOKEN]: 'Token de autenticación requerido',
  [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: 'Campo requerido',
  [ERROR_CODES.VALIDATION_INVALID_FORMAT]: 'Formato inválido',
  [ERROR_CODES.VALIDATION_OUT_OF_RANGE]: 'Valor fuera de rango',
  [ERROR_CODES.RONDA_DUPLICADA]: 'Ya existe una ronda en esta ventana de tiempo',
  [ERROR_CODES.TURNO_SOLAPADO]: 'El turno se solapa con otro existente',
  [ERROR_CODES.ESTACION_NO_ENCONTRADA]: 'Estación no encontrada',
  [ERROR_CODES.TAG_NO_REGISTRADO]: 'TAG no registrado en el sistema',
  [ERROR_CODES.DATABASE_ERROR]: 'Error de base de datos',
  [ERROR_CODES.SERIAL_PORT_ERROR]: 'Error de comunicación con el lector',
  [ERROR_CODES.NETWORK_ERROR]: 'Error de conexión de red'
};

// Colores para estados de ronda (para UI)
export const COLORES_ESTADO = {
  COMPLETA: '#22c55e', // verde
  INCOMPLETA: '#f59e0b', // amarillo/naranja
  INVALIDA: '#ef4444', // rojo
  NO_REALIZADA: '#6b7280' // gris
} as const;

// Intervalos de tiempo
export const INTERVALOS = {
  DESCARGA_LECTOR_MS: 30000, // 30 segundos
  REINTENTO_CONEXION_MS: 5000, // 5 segundos
  HEARTBEAT_MS: 60000 // 1 minuto
} as const;
