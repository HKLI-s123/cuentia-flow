-- =====================================================
-- Tabla: ComprobantesRecibidos
-- Almacena comprobantes de pago (imágenes) enviados
-- por clientes vía WhatsApp, con datos extraídos por IA
-- =====================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ComprobantesRecibidos')
BEGIN
  CREATE TABLE ComprobantesRecibidos (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    FacturaId INT NOT NULL,
    OrganizacionId INT NOT NULL,

    -- Imagen del comprobante
    ImagenBase64 NVARCHAR(MAX) NULL,
    ImagenMimetype NVARCHAR(50) NULL,

    -- Datos extraídos por OpenAI Vision
    MontoDetectado DECIMAL(18,2) NULL,
    FechaPagoDetectada DATE NULL,
    MetodoPagoDetectado NVARCHAR(10) NULL,   -- Código SAT: 03=Transferencia, 01=Efectivo, etc.
    ReferenciaBancaria NVARCHAR(100) NULL,
    BancoOrigen NVARCHAR(100) NULL,
    BancoDestino NVARCHAR(100) NULL,
    DatosExtraidosJSON NVARCHAR(MAX) NULL,   -- JSON completo del análisis de IA

    -- Estado del comprobante
    Estado NVARCHAR(20) NOT NULL DEFAULT 'pendiente',  -- pendiente, confirmado, rechazado
    MotivoRechazo NVARCHAR(500) NULL,

    -- Relación con pago/complemento si se confirma
    PagoId INT NULL,
    FacturapiComplementoId NVARCHAR(255) NULL,
    UUIDComplemento NVARCHAR(255) NULL,

    -- Mensaje de WhatsApp del cliente
    MensajeTexto NVARCHAR(MAX) NULL,
    TelefonoCliente NVARCHAR(20) NULL,

    -- Auditoría
    FechaRecepcion DATETIME NOT NULL DEFAULT GETDATE(),
    FechaConfirmacion DATETIME NULL,
    FechaRechazo DATETIME NULL,
    UsuarioConfirmoId INT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),

    -- Foreign keys
    CONSTRAINT FK_ComprobantesRecibidos_Facturas FOREIGN KEY (FacturaId) REFERENCES Facturas(Id),
    CONSTRAINT FK_ComprobantesRecibidos_Organizaciones FOREIGN KEY (OrganizacionId) REFERENCES Organizaciones(Id)
  );

  -- Índices
  CREATE INDEX IX_ComprobantesRecibidos_FacturaId ON ComprobantesRecibidos(FacturaId);
  CREATE INDEX IX_ComprobantesRecibidos_OrganizacionId ON ComprobantesRecibidos(OrganizacionId);
  CREATE INDEX IX_ComprobantesRecibidos_Estado ON ComprobantesRecibidos(Estado);
  CREATE INDEX IX_ComprobantesRecibidos_FechaRecepcion ON ComprobantesRecibidos(FechaRecepcion DESC);

  PRINT 'Tabla ComprobantesRecibidos creada exitosamente';
END
ELSE
BEGIN
  PRINT 'La tabla ComprobantesRecibidos ya existe';
END
GO
