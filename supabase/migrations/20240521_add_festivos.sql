-- ============================================
-- TABLA DE FESTIVOS
-- ============================================

CREATE TABLE IF NOT EXISTS festivos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE festivos ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura para autenticados
CREATE POLICY "Usuarios autenticados pueden ver festivos"
    ON festivos FOR SELECT
    TO authenticated
    USING (true);

-- Política de acceso total para service_role
CREATE POLICY "Service role tiene acceso total a festivos"
    ON festivos FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_festivos_updated_at
    BEFORE UPDATE ON festivos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentarios
COMMENT ON TABLE festivos IS 'Días festivos para aplicar horario de fin de semana';
