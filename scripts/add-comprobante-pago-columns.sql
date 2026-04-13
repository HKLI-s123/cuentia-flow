-- Agregar columnas para almacenar comprobante de pago en la tabla Pagos
-- Ejecutar en la base de datos de producción

ALTER TABLE Pagos ADD ComprobanteBase64 NVARCHAR(MAX) NULL;
ALTER TABLE Pagos ADD ComprobanteMimetype NVARCHAR(50) NULL;
ALTER TABLE Pagos ADD TokenComprobante NVARCHAR(64) NULL;
ALTER TABLE Pagos ADD TokenExpiracion DATETIME NULL;

-- Índice único para búsqueda por token público
CREATE UNIQUE NONCLUSTERED INDEX IX_Pagos_TokenComprobante
ON Pagos (TokenComprobante)
WHERE TokenComprobante IS NOT NULL;
