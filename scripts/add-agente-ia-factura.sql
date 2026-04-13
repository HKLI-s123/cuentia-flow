-- Agregar columna AgenteIAActivo a la tabla Facturas
-- Esta columna permite activar/desactivar el agente IA de cobranza por factura individual
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'AgenteIAActivo'
)
BEGIN
  ALTER TABLE Facturas ADD AgenteIAActivo BIT NOT NULL DEFAULT 0;
  PRINT 'Columna AgenteIAActivo agregada a Facturas';
END
ELSE
BEGIN
  PRINT 'La columna AgenteIAActivo ya existe en Facturas';
END
