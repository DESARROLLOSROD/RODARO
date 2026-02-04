-- ============================================
-- ELIMINAR RESTRICCIÓN ÚNICA EN DETALLE DE RONDA
-- Motivo: Permitir Estación 1 al inicio y al final
-- ============================================

ALTER TABLE ronda_detalle DROP CONSTRAINT IF EXISTS uq_ronda_estacion;

COMMENT ON TABLE ronda_detalle IS 'Detalle de cada estación visitada (permite múltiples visitas a la misma estación)';
