-- Script para agregar columna de API Key de seguridad en FacturaAPI
-- La clave que se genera automáticamente cuando reincias/actualizas la integración

IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Organizaciones' AND COLUMN_NAME = 'FechaActualizacionApiKey'
)
BEGIN
    ALTER TABLE Organizaciones
    ADD FechaActualizacionApiKey DATETIME NULL;
    
    PRINT 'Columna FechaActualizacionApiKey agregada exitosamente a la tabla Organizaciones';
END
ELSE
BEGIN
    PRINT 'Las columnas ya existen en la tabla Organizaciones';
END
