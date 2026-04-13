-- Agregar columna MotivoCancelacion a Suscripciones
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'Suscripciones' AND COLUMN_NAME = 'MotivoCancelacion'
)
BEGIN
  ALTER TABLE Suscripciones ADD MotivoCancelacion NVARCHAR(500) NULL;
  PRINT 'Columna MotivoCancelacion agregada a Suscripciones';
END
ELSE
BEGIN
  PRINT 'Columna MotivoCancelacion ya existe';
END
