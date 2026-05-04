-- Crear tabla para solicitudes de planes personalizados
CREATE TABLE IF NOT EXISTS solicitudes_planes_personalizados (
  id SERIAL PRIMARY KEY,
  usuarioid INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  organizacionid INTEGER REFERENCES organizaciones(id) ON DELETE SET NULL,
  requierefacturas VARCHAR(255) NOT NULL,
  requiereclientes VARCHAR(255) NOT NULL,
  requiereintegraciones TEXT,
  necesidadesespeciales TEXT,
  estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'contactado', 'propuesta', 'aceptada', 'rechazada')),
  createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  respondidoen TIMESTAMP,
  CONSTRAINT unique_user_solicitud UNIQUE(usuarioid, createdat)
);

-- Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_solicitudes_usuarioid ON solicitudes_planes_personalizados(usuarioid);
CREATE INDEX IF NOT EXISTS idx_solicitudes_organizacionid ON solicitudes_planes_personalizados(organizacionid);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes_planes_personalizados(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_createdat ON solicitudes_planes_personalizados(createdat DESC);

-- Agregar comentarios
COMMENT ON TABLE solicitudes_planes_personalizados IS 'Solicitudes de planes con límites personalizados por parte de usuarios';
COMMENT ON COLUMN solicitudes_planes_personalizados.estado IS 'Estado de la solicitud: pendiente, contactado, propuesta, aceptada, rechazada';
