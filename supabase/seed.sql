-- ============================================
-- DATOS SEMILLA (EJEMPLO)
-- ============================================

-- Insertar ruta de ejemplo
INSERT INTO rutas (nombre, descripcion, frecuencia_min)
VALUES ('Ruta Principal Edificio A', 'Ronda por todos los pisos del edificio A', 120)
ON CONFLICT DO NOTHING;

-- Insertar estaciones de ejemplo
DO $$
DECLARE
    ruta_id UUID;
BEGIN
    SELECT id INTO ruta_id FROM rutas WHERE nombre = 'Ruta Principal Edificio A';

    IF ruta_id IS NOT NULL THEN
        INSERT INTO estaciones (ruta_id, nombre, tag, orden, tiempo_esperado_seg, tolerancia_seg) VALUES
        (ruta_id, 'Entrada Principal', 'A1B2C3D4', 1, 0, 300),
        (ruta_id, 'Piso 1 - Recepción', 'E5F6G7H8', 2, 180, 300),
        (ruta_id, 'Piso 2 - Oficinas', 'I9J0K1L2', 3, 240, 300),
        (ruta_id, 'Piso 3 - Sala de Juntas', 'M3N4O5P6', 4, 240, 300),
        (ruta_id, 'Azotea', 'Q7R8S9T0', 5, 300, 300),
        (ruta_id, 'Estacionamiento', 'U1V2W3X4', 6, 360, 300)
        ON CONFLICT (ruta_id, orden) DO NOTHING;
    END IF;
END $$;

-- Insertar vigilantes de ejemplo
INSERT INTO vigilantes (nombre, numero_empleado) VALUES
('Juan Pérez García', 'VIG001'),
('María López Rodríguez', 'VIG002')
ON CONFLICT (numero_empleado) DO NOTHING;
