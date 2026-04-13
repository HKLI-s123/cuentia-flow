-- =====================================================
-- Agregar columnas para cancelación de pagos (complementos de pago)
-- Ejecutar en la base de datos Cobranza
-- =====================================================

-- FacturapiPagoId: ID del complemento de pago en Facturapi (para poder cancelarlo)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Pagos') AND name = 'FacturapiPagoId')
BEGIN
    ALTER TABLE Pagos ADD FacturapiPagoId NVARCHAR(255) NULL;
    PRINT 'Columna FacturapiPagoId agregada';
END

-- UUIDPago: UUID del complemento de pago timbrado
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Pagos') AND name = 'UUIDPago')
BEGIN
    ALTER TABLE Pagos ADD UUIDPago NVARCHAR(255) NULL;
    PRINT 'Columna UUIDPago agregada';
END

-- Cancelado: indica si el pago ha sido cancelado (default 0 = activo)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Pagos') AND name = 'Cancelado')
BEGIN
    ALTER TABLE Pagos ADD Cancelado BIT NOT NULL CONSTRAINT DF_Pagos_Cancelado DEFAULT 0;
    PRINT 'Columna Cancelado agregada';
END

-- FechaCancelacion: fecha en que se canceló el pago
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Pagos') AND name = 'FechaCancelacion')
BEGIN
    ALTER TABLE Pagos ADD FechaCancelacion DATETIME NULL;
    PRINT 'Columna FechaCancelacion agregada';
END

-- MotivoCancelacion: código de motivo SAT (01, 02, 03, 04)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Pagos') AND name = 'MotivoCancelacion')
BEGIN
    ALTER TABLE Pagos ADD MotivoCancelacion NVARCHAR(10) NULL;
    PRINT 'Columna MotivoCancelacion agregada';
END

PRINT '✅ Migración completada - Columnas de cancelación de pagos';
