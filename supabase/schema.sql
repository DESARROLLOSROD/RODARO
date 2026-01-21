-- ============================================
-- SCHEMA COMPLETO - SISTEMA DE RONDINES
-- Para Supabase (PostgreSQL)
-- ============================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLAS PRINCIPALES
-- ============================================

-- Tabla de vigilantes
CREATE TABLE IF NOT EXISTS vigilantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    numero_empleado VARCHAR(50) UNIQUE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para vigilantes
CREATE INDEX IF NOT EXISTS idx_vigilantes_activo ON vigilantes(activo);
CREATE INDEX IF NOT EXISTS idx_vigilantes_nombre ON vigilantes(nombre);

-- Tabla de rutas
CREATE TABLE IF NOT EXISTS rutas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    frecuencia_min INTEGER NOT NULL DEFAULT 120, -- 120 o 180 minutos
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_frecuencia CHECK (frecuencia_min > 0)
);

-- Índices para rutas
CREATE INDEX IF NOT EXISTS idx_rutas_activa ON rutas(activa);

-- Tabla de estaciones
CREATE TABLE IF NOT EXISTS estaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruta_id UUID NOT NULL REFERENCES rutas(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    tag VARCHAR(50) NOT NULL, -- Identificador del TAG físico (hexadecimal)
    orden INTEGER NOT NULL,
    tiempo_esperado_seg INTEGER NOT NULL DEFAULT 0, -- Tiempo esperado desde estación anterior
    tolerancia_seg INTEGER NOT NULL DEFAULT 300, -- 5 minutos por defecto
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_orden_positivo CHECK (orden > 0),
    CONSTRAINT chk_tolerancia_positiva CHECK (tolerancia_seg > 0),
    CONSTRAINT uq_ruta_orden UNIQUE (ruta_id, orden),
    CONSTRAINT uq_ruta_tag UNIQUE (ruta_id, tag)
);

-- Índices para estaciones
CREATE INDEX IF NOT EXISTS idx_estaciones_ruta ON estaciones(ruta_id);
CREATE INDEX IF NOT EXISTS idx_estaciones_tag ON estaciones(tag);
CREATE INDEX IF NOT EXISTS idx_estaciones_orden ON estaciones(ruta_id, orden);

-- Tabla de turnos (rol 24x48)
CREATE TABLE IF NOT EXISTS turnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vigilante_id UUID NOT NULL REFERENCES vigilantes(id),
    ruta_id UUID NOT NULL REFERENCES rutas(id),
    inicio TIMESTAMPTZ NOT NULL,
    fin TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_turno_fechas CHECK (fin > inicio)
);

-- Índices para turnos
CREATE INDEX IF NOT EXISTS idx_turnos_vigilante ON turnos(vigilante_id);
CREATE INDEX IF NOT EXISTS idx_turnos_ruta ON turnos(ruta_id);
CREATE INDEX IF NOT EXISTS idx_turnos_fechas ON turnos(inicio, fin);
CREATE INDEX IF NOT EXISTS idx_turnos_inicio ON turnos(inicio DESC);

-- Tabla de eventos (datos crudos del lector)
CREATE TABLE IF NOT EXISTS eventos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag VARCHAR(50) NOT NULL,
    fecha_hora TIMESTAMPTZ NOT NULL,
    lector_id VARCHAR(100),
    datos_crudos TEXT, -- Datos originales del lector
    procesado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_evento UNIQUE (tag, fecha_hora)
);

-- Índices para eventos
CREATE INDEX IF NOT EXISTS idx_eventos_tag ON eventos(tag);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos(fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_procesado ON eventos(procesado) WHERE procesado = false;

-- Tipos enumerados para estatus
CREATE TYPE estatus_ronda AS ENUM ('COMPLETA', 'INCOMPLETA', 'INVALIDA', 'NO_REALIZADA');
CREATE TYPE estatus_detalle AS ENUM ('A_TIEMPO', 'RETRASADO', 'OMITIDO');

-- Tabla de rondas
CREATE TABLE IF NOT EXISTS rondas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruta_id UUID NOT NULL REFERENCES rutas(id),
    turno_id UUID NOT NULL REFERENCES turnos(id),
    vigilante_id UUID NOT NULL REFERENCES vigilantes(id),
    inicio TIMESTAMPTZ,
    fin TIMESTAMPTZ,
    ventana_inicio TIMESTAMPTZ NOT NULL, -- Inicio de ventana esperada
    ventana_fin TIMESTAMPTZ NOT NULL, -- Fin de ventana esperada
    estatus estatus_ronda NOT NULL DEFAULT 'INCOMPLETA',
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para rondas
CREATE INDEX IF NOT EXISTS idx_rondas_turno ON rondas(turno_id);
CREATE INDEX IF NOT EXISTS idx_rondas_vigilante ON rondas(vigilante_id);
CREATE INDEX IF NOT EXISTS idx_rondas_ruta ON rondas(ruta_id);
CREATE INDEX IF NOT EXISTS idx_rondas_estatus ON rondas(estatus);
CREATE INDEX IF NOT EXISTS idx_rondas_ventana ON rondas(ventana_inicio, ventana_fin);
CREATE INDEX IF NOT EXISTS idx_rondas_inicio ON rondas(inicio DESC);

-- Tabla de detalle de ronda
CREATE TABLE IF NOT EXISTS ronda_detalle (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ronda_id UUID NOT NULL REFERENCES rondas(id) ON DELETE CASCADE,
    estacion_id UUID NOT NULL REFERENCES estaciones(id),
    evento_id UUID REFERENCES eventos(id),
    orden INTEGER NOT NULL,
    fecha_hora TIMESTAMPTZ,
    diferencia_seg INTEGER, -- Diferencia vs tiempo esperado
    estatus estatus_detalle NOT NULL DEFAULT 'OMITIDO',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_ronda_estacion UNIQUE (ronda_id, estacion_id)
);

-- Índices para ronda_detalle
CREATE INDEX IF NOT EXISTS idx_ronda_detalle_ronda ON ronda_detalle(ronda_id);
CREATE INDEX IF NOT EXISTS idx_ronda_detalle_estacion ON ronda_detalle(estacion_id);
CREATE INDEX IF NOT EXISTS idx_ronda_detalle_orden ON ronda_detalle(ronda_id, orden);

-- Tabla de logs de descarga
CREATE TABLE IF NOT EXISTS logs_descarga (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lector_id VARCHAR(100) NOT NULL,
    timestamp_descarga TIMESTAMPTZ NOT NULL,
    eventos_recibidos INTEGER DEFAULT 0,
    eventos_nuevos INTEGER DEFAULT 0,
    eventos_duplicados INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_logs_descarga_lector ON logs_descarga(lector_id);
CREATE INDEX IF NOT EXISTS idx_logs_descarga_fecha ON logs_descarga(timestamp_descarga DESC);

-- ============================================
-- FUNCIONES Y TRIGGERS
-- ============================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_vigilantes_updated_at
    BEFORE UPDATE ON vigilantes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rutas_updated_at
    BEFORE UPDATE ON rutas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estaciones_updated_at
    BEFORE UPDATE ON estaciones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rondas_updated_at
    BEFORE UPDATE ON rondas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE vigilantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE estaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rondas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ronda_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_descarga ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios autenticados (lectura)
CREATE POLICY "Usuarios autenticados pueden ver vigilantes"
    ON vigilantes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden ver rutas"
    ON rutas FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden ver estaciones"
    ON estaciones FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden ver turnos"
    ON turnos FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden ver eventos"
    ON eventos FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden ver rondas"
    ON rondas FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden ver detalle de rondas"
    ON ronda_detalle FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden ver logs"
    ON logs_descarga FOR SELECT
    TO authenticated
    USING (true);

-- Políticas para service role (todas las operaciones)
CREATE POLICY "Service role tiene acceso total a vigilantes"
    ON vigilantes FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role tiene acceso total a rutas"
    ON rutas FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role tiene acceso total a estaciones"
    ON estaciones FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role tiene acceso total a turnos"
    ON turnos FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role tiene acceso total a eventos"
    ON eventos FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role tiene acceso total a rondas"
    ON rondas FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role tiene acceso total a detalle de rondas"
    ON ronda_detalle FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role tiene acceso total a logs"
    ON logs_descarga FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- DATOS DE EJEMPLO (opcional)
-- ============================================

-- Insertar ruta de ejemplo
INSERT INTO rutas (nombre, descripcion, frecuencia_min) VALUES
('Ruta Principal Edificio A', 'Ronda por todos los pisos del edificio A', 120);

-- Insertar estaciones de ejemplo (obtener el ID de la ruta creada)
DO $$
DECLARE
    ruta_id UUID;
BEGIN
    SELECT id INTO ruta_id FROM rutas WHERE nombre = 'Ruta Principal Edificio A';

    INSERT INTO estaciones (ruta_id, nombre, tag, orden, tiempo_esperado_seg, tolerancia_seg) VALUES
    (ruta_id, 'Entrada Principal', 'A1B2C3D4', 1, 0, 300),
    (ruta_id, 'Piso 1 - Recepción', 'E5F6G7H8', 2, 180, 300),
    (ruta_id, 'Piso 2 - Oficinas', 'I9J0K1L2', 3, 240, 300),
    (ruta_id, 'Piso 3 - Sala de Juntas', 'M3N4O5P6', 4, 240, 300),
    (ruta_id, 'Azotea', 'Q7R8S9T0', 5, 300, 300),
    (ruta_id, 'Estacionamiento', 'U1V2W3X4', 6, 360, 300);
END $$;

-- Insertar vigilante de ejemplo
INSERT INTO vigilantes (nombre, numero_empleado) VALUES
('Juan Pérez García', 'VIG001'),
('María López Rodríguez', 'VIG002');

-- ============================================
-- VISTAS ÚTILES
-- ============================================

-- Vista de resumen de rondas por turno
CREATE OR REPLACE VIEW v_resumen_turnos AS
SELECT
    t.id AS turno_id,
    t.inicio,
    t.fin,
    v.nombre AS vigilante,
    r.nombre AS ruta,
    r.frecuencia_min,
    COUNT(ro.id) AS total_rondas,
    COUNT(CASE WHEN ro.estatus = 'COMPLETA' THEN 1 END) AS completas,
    COUNT(CASE WHEN ro.estatus = 'INCOMPLETA' THEN 1 END) AS incompletas,
    COUNT(CASE WHEN ro.estatus = 'INVALIDA' THEN 1 END) AS invalidas,
    COUNT(CASE WHEN ro.estatus = 'NO_REALIZADA' THEN 1 END) AS no_realizadas,
    ROUND(
        COUNT(CASE WHEN ro.estatus = 'COMPLETA' THEN 1 END)::NUMERIC /
        NULLIF(EXTRACT(EPOCH FROM (t.fin - t.inicio)) / 60 / r.frecuencia_min, 0) * 100,
        2
    ) AS porcentaje_cumplimiento
FROM turnos t
JOIN vigilantes v ON t.vigilante_id = v.id
JOIN rutas r ON t.ruta_id = r.id
LEFT JOIN rondas ro ON t.id = ro.turno_id
GROUP BY t.id, t.inicio, t.fin, v.nombre, r.nombre, r.frecuencia_min;

-- Vista de eventos recientes
CREATE OR REPLACE VIEW v_eventos_recientes AS
SELECT
    e.id,
    e.tag,
    e.fecha_hora,
    e.procesado,
    est.nombre AS estacion,
    r.nombre AS ruta
FROM eventos e
LEFT JOIN estaciones est ON e.tag = est.tag
LEFT JOIN rutas r ON est.ruta_id = r.id
ORDER BY e.fecha_hora DESC
LIMIT 100;

-- ============================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ============================================

COMMENT ON TABLE vigilantes IS 'Registro de vigilantes del sistema';
COMMENT ON TABLE rutas IS 'Definición de rutas de rondines';
COMMENT ON TABLE estaciones IS 'Estaciones (puntos de control) de cada ruta';
COMMENT ON TABLE turnos IS 'Turnos asignados a vigilantes (esquema 24x48)';
COMMENT ON TABLE eventos IS 'Eventos crudos recibidos del lector de TAGs';
COMMENT ON TABLE rondas IS 'Rondas procesadas con su estatus';
COMMENT ON TABLE ronda_detalle IS 'Detalle de cada estación visitada en una ronda';
COMMENT ON TABLE logs_descarga IS 'Log de descargas del agente local';

COMMENT ON COLUMN estaciones.tag IS 'Identificador hexadecimal del TAG físico';
COMMENT ON COLUMN estaciones.tiempo_esperado_seg IS 'Tiempo esperado en segundos desde la estación anterior';
COMMENT ON COLUMN estaciones.tolerancia_seg IS 'Tolerancia en segundos para considerar llegada a tiempo';
COMMENT ON COLUMN rondas.ventana_inicio IS 'Inicio de la ventana de tiempo esperada para esta ronda';
COMMENT ON COLUMN rondas.ventana_fin IS 'Fin de la ventana de tiempo esperada para esta ronda';
