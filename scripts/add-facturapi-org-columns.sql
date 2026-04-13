-- Script para agregar columnas de FacturaAPI a la tabla Organizaciones
-- Ejecutar una sola vez en la base de datos

BEGIN TRANSACTION;

-- Verificar si las columnas ya existen antes de agregarlas
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Organizaciones' AND COLUMN_NAME = 'IdFacturaAPI'
)
BEGIN
    ALTER TABLE Organizaciones
    ADD IdFacturaAPI NVARCHAR(100) NULL,
        ApiKeyFacturaAPI NVARCHAR(100) NULL,
        FechaActualizacionFacturaAPI DATETIME NULL;
    
    PRINT 'Columnas de FacturaAPI agregadas a Organizaciones exitosamente.';
END
ELSE
BEGIN
    PRINT 'Las columnas de FacturaAPI ya existen en la tabla Organizaciones.';
END

COMMIT TRANSACTION;
