-- MIGRACIÓN: Agregar llaves foráneas a tabla Clientes
-- Fecha: 2025-10-05
-- Propósito: Normalizar campos RegimenFiscal, Estado y Pais con llaves foráneas

USE Cobranza;
GO

-- PASO 1: Agregar nuevas columnas con llaves foráneas
ALTER TABLE Clientes
ADD RegimenFiscalId INT NULL,
    EstadoId INT NULL,
    PaisId INT NULL;
GO

-- PASO 2: Migrar datos existentes de RegimenFiscal (texto) a RegimenFiscalId (int)
-- Mapear por descripción del régimen
UPDATE c
SET c.RegimenFiscalId = r.ID_Regimen
FROM Clientes c
INNER JOIN Regimen r ON c.RegimenFiscal = r.Descripcion
WHERE c.RegimenFiscal IS NOT NULL;
GO

-- PASO 3: Migrar datos existentes de Estado (texto) a EstadoId (int)
-- Mapear por nombre del estado
UPDATE c
SET c.EstadoId = e.ID
FROM Clientes c
INNER JOIN Estados e ON c.Estado = e.NombreEstado
WHERE c.Estado IS NOT NULL;
GO

-- PASO 4: Migrar datos existentes de Pais (texto) a PaisId (int)
-- Mapear por nombre del país
UPDATE c
SET c.PaisId = p.ID
FROM Clientes c
INNER JOIN Paises p ON c.Pais = p.NombrePais
WHERE c.Pais IS NOT NULL;
GO

-- PASO 5: Agregar llaves foráneas
ALTER TABLE Clientes
ADD CONSTRAINT FK_Clientes_Regimen
    FOREIGN KEY (RegimenFiscalId) REFERENCES Regimen(ID_Regimen);

ALTER TABLE Clientes
ADD CONSTRAINT FK_Clientes_Estado
    FOREIGN KEY (EstadoId) REFERENCES Estados(ID);

ALTER TABLE Clientes
ADD CONSTRAINT FK_Clientes_Pais
    FOREIGN KEY (PaisId) REFERENCES Paises(ID);
GO

-- PASO 6 (OPCIONAL): Eliminar columnas antiguas de texto
-- ⚠️ SOLO EJECUTAR DESPUÉS DE VERIFICAR QUE TODO FUNCIONA CORRECTAMENTE
-- ALTER TABLE Clientes DROP COLUMN RegimenFiscal;
-- ALTER TABLE Clientes DROP COLUMN Estado;
-- ALTER TABLE Clientes DROP COLUMN Pais;
-- GO

PRINT 'Migración completada exitosamente';
PRINT 'Nuevas columnas agregadas: RegimenFiscalId, EstadoId, PaisId';
PRINT 'Llaves foráneas creadas correctamente';
PRINT 'Las columnas antiguas (RegimenFiscal, Estado, Pais) se mantienen para compatibilidad';
PRINT 'Puedes eliminarlas después de actualizar el código de la aplicación';
