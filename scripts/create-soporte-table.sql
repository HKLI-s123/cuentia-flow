-- Tabla para tickets de soporte
CREATE TABLE IF NOT EXISTS tickets_soporte (
  id SERIAL PRIMARY KEY,
  usuarioid INTEGER NOT NULL REFERENCES usuarios(id),
  organizacionid INTEGER REFERENCES organizaciones(id),
  asunto VARCHAR(200) NOT NULL,
  categoria VARCHAR(50) NOT NULL DEFAULT 'general',
  descripcion TEXT NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'abierto',
  createdat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_soporte_usuario ON tickets_soporte(usuarioid);
CREATE INDEX IF NOT EXISTS idx_tickets_soporte_org ON tickets_soporte(organizacionid);
