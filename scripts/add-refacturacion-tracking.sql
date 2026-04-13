-- Agregar columnas de tracking para refacturación automática
-- UltimaFacturaGenerada: fecha de la última factura generada por recurrencia
-- FacturasGeneradas: contador total de facturas generadas desde este template

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'UltimaFacturaGenerada')
BEGIN
    ALTER TABLE Facturas ADD UltimaFacturaGenerada DATETIME NULL;
    PRINT 'Columna UltimaFacturaGenerada agregada';
END
ELSE
    PRINT 'Columna UltimaFacturaGenerada ya existe';

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'FacturasGeneradas')
BEGIN
    ALTER TABLE Facturas ADD FacturasGeneradas INT NULL DEFAULT 0;
    PRINT 'Columna FacturasGeneradas agregada';
END
ELSE
    PRINT 'Columna FacturasGeneradas ya existe';
