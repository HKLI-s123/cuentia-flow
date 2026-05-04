-- Migration: Tabla comprobantes_facturas y columnas de token en facturas
-- Ejecutar con: psql -U usuario -d base_de_datos -f create-comprobantes-factura.sql

-- 1. Token de link público en tabla Facturas (para invitar al cliente a subir comprobante)
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS tokencomprobantecf VARCHAR(64);
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS tokenexpiracioncf TIMESTAMP;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS notascliente TEXT;

-- 2. Tabla de comprobantes subidos a nivel factura
CREATE TABLE IF NOT EXISTS comprobantes_facturas (
  id SERIAL PRIMARY KEY,
  facturaid INTEGER NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  organizacionid INTEGER NOT NULL,
  imagenbase64 TEXT NOT NULL,
  imagenmimetype VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
  fechasubida TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_cliente VARCHAR(64),
  token_usado VARCHAR(128),  -- últimos 16 chars del token usado (para auditoría)
  visto BOOLEAN NOT NULL DEFAULT FALSE,  -- para notificaciones al administrador
  createdat TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_comprobantes_facturas_facturaid ON comprobantes_facturas(facturaid);
CREATE INDEX IF NOT EXISTS idx_comprobantes_facturas_organizacionid ON comprobantes_facturas(organizacionid);
CREATE INDEX IF NOT EXISTS idx_comprobantes_facturas_visto ON comprobantes_facturas(visto) WHERE visto = FALSE;
CREATE INDEX IF NOT EXISTS idx_facturas_tokencomprobantecf ON facturas(tokencomprobantecf) WHERE tokencomprobantecf IS NOT NULL;
