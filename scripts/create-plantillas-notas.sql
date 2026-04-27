-- Tabla para plantillas de notas reutilizables del cliente
CREATE TABLE IF NOT EXISTS PlantillasNotas (
  Id SERIAL PRIMARY KEY,
  OrganizacionId INT NOT NULL REFERENCES Organizaciones(Id) ON DELETE CASCADE,
  Nombre VARCHAR(100) NOT NULL,
  Contenido TEXT NOT NULL,
  CreatedAt TIMESTAMP DEFAULT NOW(),
  UpdatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plantillas_notas_org ON PlantillasNotas(OrganizacionId);
