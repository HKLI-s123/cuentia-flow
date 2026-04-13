-- ============================================================
-- Script: Columnas para el dashboard Cobrador IA
-- Fecha: 2026-03-30
-- ============================================================

-- 1. AutoComplementoPago: permite al usuario habilitar complemento automático por cliente
--    Si está activo, al recibir comprobante de pago el bot genera el complemento automáticamente
--    Si no está activo, se muestra botón "Confirmar Pago" en el dashboard
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Clientes' AND COLUMN_NAME = 'AutoComplementoPago'
)
BEGIN
  ALTER TABLE Clientes ADD AutoComplementoPago BIT NOT NULL DEFAULT 0;
  PRINT 'Columna AutoComplementoPago agregada a Clientes';
END
ELSE
  PRINT 'Columna AutoComplementoPago ya existe en Clientes';
GO

-- 2. ComprobantePagoRecibido: indica que el cliente envió un comprobante de pago vía WhatsApp
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'GestionesCobranza' AND COLUMN_NAME = 'ComprobantePagoRecibido'
)
BEGIN
  ALTER TABLE GestionesCobranza ADD ComprobantePagoRecibido BIT NOT NULL DEFAULT 0;
  PRINT 'Columna ComprobantePagoRecibido agregada a GestionesCobranza';
END
ELSE
  PRINT 'Columna ComprobantePagoRecibido ya existe en GestionesCobranza';
GO

-- 3. PagoConfirmado: indica si el pago fue confirmado (manual o auto)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'GestionesCobranza' AND COLUMN_NAME = 'PagoConfirmado'
)
BEGIN
  ALTER TABLE GestionesCobranza ADD PagoConfirmado BIT NOT NULL DEFAULT 0;
  PRINT 'Columna PagoConfirmado agregada a GestionesCobranza';
END
ELSE
  PRINT 'Columna PagoConfirmado ya existe en GestionesCobranza';
GO
