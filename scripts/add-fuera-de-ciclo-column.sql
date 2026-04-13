-- Agregar columna RecibidoFueraDeCiclo a ComprobantesRecibidos
-- Indica si el comprobante fue recibido fuera del ciclo de cobranza (fuera de horario o sin contacto previo)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'ComprobantesRecibidos' AND COLUMN_NAME = 'RecibidoFueraDeCiclo'
)
BEGIN
  ALTER TABLE ComprobantesRecibidos
  ADD RecibidoFueraDeCiclo BIT NOT NULL DEFAULT 0;
  PRINT 'Columna RecibidoFueraDeCiclo agregada a ComprobantesRecibidos';
END
ELSE
BEGIN
  PRINT 'Columna RecibidoFueraDeCiclo ya existe';
END
