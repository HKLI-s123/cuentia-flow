-- MIGRACIÓN: Agregar campo MetodoPago a Facturas
-- Fecha: 2025-10-06
-- Propósito: Agregar método de pago según catálogo SAT (PUE/PPD)

USE Cobranza;
GO

-- Agregar campo MetodoPago a Facturas
IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'MetodoPago' AND object_id = OBJECT_ID('Facturas'))
BEGIN
    ALTER TABLE Facturas ADD MetodoPago NVARCHAR(10) DEFAULT 'PUE';
    PRINT 'Campo MetodoPago agregado a tabla Facturas';
END
ELSE
    PRINT 'Campo MetodoPago ya existe en tabla Facturas';
GO

-- Actualizar facturas existentes según condiciones de pago
UPDATE Facturas
SET MetodoPago = CASE
    WHEN CondicionesPago IN ('De Contado', 'contado', '7 Días', '7-dias') THEN 'PUE'
    ELSE 'PPD'
END
WHERE MetodoPago IS NULL OR MetodoPago = '';
GO

PRINT 'Migración completada exitosamente';
PRINT 'Opciones de MetodoPago:';
PRINT '  - PUE: Pago en Una sola Exhibición';
PRINT '  - PPD: Pago en Parcialidades o Diferido';
GO
