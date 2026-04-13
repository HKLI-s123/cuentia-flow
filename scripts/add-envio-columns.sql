-- Agregar columnas de preferencias de envío para facturas programadas y recurrentes
-- EnviarPorCorreo: si la factura debe enviarse por email al timbrarse
-- EnviarPorWhatsApp: si la factura debe enviarse por WhatsApp al timbrarse

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'EnviarPorCorreo')
BEGIN
    ALTER TABLE Facturas ADD EnviarPorCorreo BIT NULL DEFAULT 0;
    PRINT 'Columna EnviarPorCorreo agregada';
END
ELSE
    PRINT 'Columna EnviarPorCorreo ya existe';

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'EnviarPorWhatsApp')
BEGIN
    ALTER TABLE Facturas ADD EnviarPorWhatsApp BIT NULL DEFAULT 0;
    PRINT 'Columna EnviarPorWhatsApp agregada';
END
ELSE
    PRINT 'Columna EnviarPorWhatsApp ya existe';
