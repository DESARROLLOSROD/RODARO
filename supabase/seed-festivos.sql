-- ============================================
-- SEED DE FESTIVOS (MÉXICO 2024-2026)
-- ============================================

INSERT INTO festivos (fecha, descripcion) VALUES
-- 2024
('2024-01-01', 'Año Nuevo'),
('2024-02-05', 'Aniversario de la Constitución Mexicana'),
('2024-03-18', 'Natalicio de Benito Juárez'),
('2024-05-01', 'Día del Trabajo'),
('2024-06-02', 'Jornada Electoral'),
('2024-09-16', 'Día de la Independencia de México'),
('2024-10-01', 'Transmisión del Poder Ejecutivo Federal'),
('2024-11-18', 'Aniversario de la Revolución Mexicana'),
('2024-12-25', 'Navidad'),

-- 2025
('2025-01-01', 'Año Nuevo'),
('2025-02-03', 'Aniversario de la Constitución Mexicana'),
('2025-03-17', 'Natalicio de Benito Juárez'),
('2025-05-01', 'Día del Trabajo'),
('2025-09-16', 'Día de la Independencia de México'),
('2025-11-17', 'Aniversario de la Revolución Mexicana'),
('2025-12-25', 'Navidad'),

-- 2026
('2026-01-01', 'Año Nuevo'),
('2026-02-02', 'Aniversario de la Constitución Mexicana'),
('2026-03-16', 'Natalicio de Benito Juárez'),
('2026-05-01', 'Día del Trabajo'),
('2026-09-16', 'Día de la Independencia de México'),
('2026-11-16', 'Aniversario de la Revolución Mexicana'),
('2026-12-25', 'Navidad')
ON CONFLICT (fecha) DO UPDATE 
SET descripcion = EXCLUDED.descripcion;
