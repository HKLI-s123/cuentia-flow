-- Agregar columna MotivoEscalamiento a GestionesCobranza
-- Almacena el resumen/razón cuando RequiereSeguimiento = 1 (escalamiento a humano)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'GestionesCobranza' AND COLUMN_NAME = 'MotivoEscalamiento'
)
BEGIN
  ALTER TABLE GestionesCobranza ADD MotivoEscalamiento NVARCHAR(500) NULL;
  PRINT 'Columna MotivoEscalamiento agregada a GestionesCobranza';
END
ELSE
BEGIN
  PRINT 'Columna MotivoEscalamiento ya existe en GestionesCobranza';
END
