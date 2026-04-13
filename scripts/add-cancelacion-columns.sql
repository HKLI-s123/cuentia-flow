-- Script para agregar columnas de cancelación a la tabla Facturas
-- Ejecutar en la base de datos antes de usar la funcionalidad de cancelación

-- Motivo de cancelación SAT (01, 02, 03, 04)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Facturas') AND name = 'MotivoCancelacion')
BEGIN
  ALTER TABLE Facturas ADD MotivoCancelacion NVARCHAR(10) NULL;
  PRINT 'Columna MotivoCancelacion agregada';
END

-- Descripción del motivo para referencia
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Facturas') AND name = 'MotivoCancelacionDescripcion')
BEGIN
  ALTER TABLE Facturas ADD MotivoCancelacionDescripcion NVARCHAR(255) NULL;
  PRINT 'Columna MotivoCancelacionDescripcion agregada';
END

-- Estado de cancelación de Facturapi: none, pending, accepted, rejected, expired
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Facturas') AND name = 'EstadoCancelacion')
BEGIN
  ALTER TABLE Facturas ADD EstadoCancelacion NVARCHAR(20) NULL;
  PRINT 'Columna EstadoCancelacion agregada';
END

-- ID de la factura que sustituye (para motivo 01)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Facturas') AND name = 'FacturaSustitucionId')
BEGIN
  ALTER TABLE Facturas ADD FacturaSustitucionId NVARCHAR(100) NULL;
  PRINT 'Columna FacturaSustitucionId agregada';
END

-- Fecha de solicitud de cancelación
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Facturas') AND name = 'FechaCancelacion')
BEGIN
  ALTER TABLE Facturas ADD FechaCancelacion DATETIME NULL;
  PRINT 'Columna FechaCancelacion agregada';
END

PRINT 'Script completado exitosamente';
