-- Script para agregar columnas de FacturaAPI a la tabla Clientes
-- Ejecutar una sola vez en la base de datos

BEGIN TRANSACTION;

-- Verificar si las columnas ya existen antes de agregarlas
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Clientes' AND COLUMN_NAME = 'IdClienteFacturaAPI'
)
BEGIN
    ALTER TABLE Clientes
    ADD IdClienteFacturaAPI NVARCHAR(100) NULL,
        FechaRegistroFacturaAPI DATETIME NULL,
        SincronizadoFacturaAPI BIT DEFAULT 0,
        ErrorSincronizacionFacturaAPI NVARCHAR(MAX) NULL;
    
    PRINT 'Columnas de FacturaAPI agregadas exitosamente.';
END
ELSE
BEGIN
    PRINT 'Las columnas de FacturaAPI ya existen en la tabla Clientes.';
END

COMMIT TRANSACTION;
