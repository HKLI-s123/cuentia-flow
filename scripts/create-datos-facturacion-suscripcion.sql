-- Script para agregar datos de facturación de suscripciones
-- Los usuarios pueden solicitar factura CFDI para sus pagos de suscripción
-- Estos datos son del receptor de la factura (quien paga), no de la organización emisora

-- Tabla para almacenar datos fiscales del suscriptor
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'DatosFacturacionSuscripcion')
BEGIN
    CREATE TABLE DatosFacturacionSuscripcion (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OrganizacionId INT NOT NULL,
        RequiereFactura BIT NOT NULL DEFAULT 0,
        RFC NVARCHAR(13) NOT NULL,
        RazonSocial NVARCHAR(255) NOT NULL,
        RegimenFiscalId INT NOT NULL,
        UsoCFDI NVARCHAR(10) NOT NULL DEFAULT 'G03', -- Gastos en general
        Correo NVARCHAR(255) NOT NULL,
        -- Domicilio fiscal
        CodigoPostal NVARCHAR(5) NOT NULL,
        -- Control
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        -- FK
        CONSTRAINT FK_DatosFacturacion_Organizacion FOREIGN KEY (OrganizacionId) REFERENCES Organizaciones(Id),
        CONSTRAINT FK_DatosFacturacion_Regimen FOREIGN KEY (RegimenFiscalId) REFERENCES Regimen(ID_Regimen),
        CONSTRAINT UQ_DatosFacturacion_Org UNIQUE (OrganizacionId)
    );

    CREATE INDEX IX_DatosFacturacion_Org ON DatosFacturacionSuscripcion(OrganizacionId);
    PRINT 'Tabla DatosFacturacionSuscripcion creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla DatosFacturacionSuscripcion ya existe';
END
GO
