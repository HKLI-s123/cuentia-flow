-- Agregar columna FacturaOrigenId para vincular facturas hijas con su template de recurrencia
ALTER TABLE Facturas ADD FacturaOrigenId INT NULL;

-- Foreign key a sí misma
ALTER TABLE Facturas ADD CONSTRAINT FK_Facturas_FacturaOrigen
  FOREIGN KEY (FacturaOrigenId) REFERENCES Facturas(Id);

-- Índice para búsquedas rápidas de hijas por template
CREATE INDEX IX_Facturas_FacturaOrigenId ON Facturas(FacturaOrigenId)
  WHERE FacturaOrigenId IS NOT NULL;
