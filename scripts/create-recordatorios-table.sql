-- Tabla para almacenar los recordatorios enviados a clientes
CREATE TABLE Recordatorios (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    FacturaId INT NOT NULL,
    TipoMensaje VARCHAR(50) NOT NULL, -- 'CORREO', 'SMS', 'URL'
    Destinatario VARCHAR(255) NOT NULL,
    CC VARCHAR(500) NULL,
    Asunto VARCHAR(500) NULL,
    Mensaje TEXT NULL,
    FechaEnvio DATETIME NOT NULL DEFAULT GETDATE(),
    Visto BIT NOT NULL DEFAULT 0,
    FechaVisto DATETIME NULL,
    MetodoEnvio VARCHAR(50) NOT NULL DEFAULT 'Manual', -- 'Manual', 'Automatico'
    Estado VARCHAR(50) NOT NULL DEFAULT 'Enviado', -- 'Enviado', 'Fallido', 'Pendiente'
    MessageId VARCHAR(500) NULL, -- ID del mensaje de correo
    ErrorMessage TEXT NULL,
    CreadoPor INT NULL,
    CONSTRAINT FK_Recordatorios_Facturas FOREIGN KEY (FacturaId) REFERENCES Facturas(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Recordatorios_Usuario FOREIGN KEY (CreadoPor) REFERENCES Usuarios(Id)
);

-- Índices para mejorar el rendimiento
CREATE INDEX IX_Recordatorios_FacturaId ON Recordatorios(FacturaId);
CREATE INDEX IX_Recordatorios_FechaEnvio ON Recordatorios(FechaEnvio);
CREATE INDEX IX_Recordatorios_Visto ON Recordatorios(Visto);
