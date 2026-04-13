-- ============================================
-- Azure SQL Server Schema Export
-- Database: Cobranza
-- Exported: 2026-04-02T18:57:34.412Z
-- ============================================

-- ----------------------------------------
-- Table: Agentes_Clientes
-- ----------------------------------------
CREATE TABLE [Agentes_Clientes] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [ClienteId] INT NOT NULL,
  [UsuarioId] INT NOT NULL,
  [RolAgente] NVARCHAR(100) NULL,
  [CreatedAt] DATETIME NULL DEFAULT (getdate()),
  [UpdatedAt] DATETIME NULL DEFAULT (getdate())
);

ALTER TABLE [Agentes_Clientes] ADD CONSTRAINT [PK__Agentes___3214EC07F484DF04] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: audit_log
-- ----------------------------------------
CREATE TABLE [audit_log] (
  [id] INT IDENTITY(1,1) NOT NULL,
  [usuario_id] INT NOT NULL,
  [organizacion_id] INT NOT NULL,
  [action] NVARCHAR(50) NOT NULL,
  [details] NVARCHAR(MAX) NULL,
  [ip_address] NVARCHAR(45) NULL,
  [timestamp] DATETIME2 NULL DEFAULT (getutcdate())
);

ALTER TABLE [audit_log] ADD CONSTRAINT [PK__audit_lo__3213E83FA6D6A7DA] PRIMARY KEY ([id]);

-- ----------------------------------------
-- Table: auditoria_intentos_registro
-- ----------------------------------------
CREATE TABLE [auditoria_intentos_registro] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [UsuarioId] INT NULL,
  [RFC] NVARCHAR(13) NULL,
  [Tipo] NVARCHAR(50) NULL,
  [Mensaje] NVARCHAR(255) NULL,
  [Timestamp] DATETIME NULL DEFAULT (getdate())
);

ALTER TABLE [auditoria_intentos_registro] ADD CONSTRAINT [PK__auditori__3214EC07608FB530] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: Clientes
-- ----------------------------------------
CREATE TABLE [Clientes] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [NombreComercial] NVARCHAR(200) NULL,
  [RazonSocial] NVARCHAR(200) NOT NULL,
  [RFC] NVARCHAR(13) NOT NULL,
  [RegimenFiscal] NVARCHAR(100) NULL,
  [CondicionesPago] NVARCHAR(100) NULL,
  [CorreoPrincipal] NVARCHAR(150) NULL,
  [Pais] NVARCHAR(100) NULL,
  [CodigoPais] NVARCHAR(10) NULL,
  [Telefono] NVARCHAR(20) NULL,
  [Estado] NVARCHAR(100) NULL,
  [Calle] NVARCHAR(200) NULL,
  [NumeroExterior] NVARCHAR(20) NULL,
  [NumeroInterior] NVARCHAR(20) NULL,
  [CodigoPostal] NVARCHAR(10) NULL,
  [Colonia] NVARCHAR(100) NULL,
  [Ciudad] NVARCHAR(100) NULL,
  [OrganizacionId] INT NOT NULL DEFAULT ((1)),
  [RegimenFiscalId] INT NULL,
  [EstadoId] INT NULL,
  [PaisId] INT NULL,
  [IdClienteFacturaAPI] NVARCHAR(50) NULL,
  [FechaRegistroFacturaAPI] DATETIME NULL,
  [SincronizadoFacturaAPI] BIT NULL DEFAULT ((0)),
  [ErrorSincronizacionFacturaAPI] NVARCHAR(MAX) NULL,
  [TelefonoWhatsApp] NVARCHAR(20) NULL,
  [AutoComplementoPago] BIT NOT NULL DEFAULT ((0))
);

ALTER TABLE [Clientes] ADD CONSTRAINT [PK__Clientes__3214EC074E494E72] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: ComprobantesRecibidos
-- ----------------------------------------
CREATE TABLE [ComprobantesRecibidos] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [FacturaId] INT NOT NULL,
  [OrganizacionId] INT NOT NULL,
  [ImagenBase64] NVARCHAR(MAX) NULL,
  [ImagenMimetype] NVARCHAR(50) NULL,
  [MontoDetectado] DECIMAL(18, 2) NULL,
  [FechaPagoDetectada] DATE NULL,
  [MetodoPagoDetectado] NVARCHAR(10) NULL,
  [ReferenciaBancaria] NVARCHAR(100) NULL,
  [BancoOrigen] NVARCHAR(100) NULL,
  [BancoDestino] NVARCHAR(100) NULL,
  [DatosExtraidosJSON] NVARCHAR(MAX) NULL,
  [Estado] NVARCHAR(20) NOT NULL DEFAULT ('pendiente'),
  [MotivoRechazo] NVARCHAR(500) NULL,
  [PagoId] INT NULL,
  [FacturapiComplementoId] NVARCHAR(255) NULL,
  [UUIDComplemento] NVARCHAR(255) NULL,
  [MensajeTexto] NVARCHAR(MAX) NULL,
  [TelefonoCliente] NVARCHAR(20) NULL,
  [FechaRecepcion] DATETIME NOT NULL DEFAULT (getdate()),
  [FechaConfirmacion] DATETIME NULL,
  [FechaRechazo] DATETIME NULL,
  [UsuarioConfirmoId] INT NULL,
  [CreatedAt] DATETIME NOT NULL DEFAULT (getdate()),
  [UpdatedAt] DATETIME NOT NULL DEFAULT (getdate()),
  [RecibidoFueraDeCiclo] BIT NOT NULL DEFAULT ((0))
);

ALTER TABLE [ComprobantesRecibidos] ADD CONSTRAINT [PK__Comproba__3214EC07F01FB3B9] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: ConceptosFactura
-- ----------------------------------------
CREATE TABLE [ConceptosFactura] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [FacturaId] INT NOT NULL,
  [Nombre] NVARCHAR(255) NOT NULL,
  [Descripcion] NVARCHAR(500) NULL,
  [ClaveProdServ] NVARCHAR(50) NULL,
  [UnidadMedida] NVARCHAR(10) NOT NULL,
  [Cantidad] DECIMAL(18, 2) NOT NULL,
  [PrecioUnitario] DECIMAL(18, 2) NOT NULL,
  [Subtotal] DECIMAL(18, 2) NOT NULL,
  [MonedaProducto] NVARCHAR(10) NULL,
  [ObjetoImpuesto] NVARCHAR(10) NULL,
  [TotalImpuestos] DECIMAL(18, 2) NULL DEFAULT ((0)),
  [Total] DECIMAL(18, 2) NOT NULL
);

ALTER TABLE [ConceptosFactura] ADD CONSTRAINT [PK__Concepto__3214EC07CD4C5EEF] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: configuracion_organizacion
-- ----------------------------------------
CREATE TABLE [configuracion_organizacion] (
  [id] INT IDENTITY(1,1) NOT NULL,
  [organizacion_id] INT NOT NULL,
  [nombre_comercial] VARCHAR(255) NULL,
  [email_corporativo] VARCHAR(255) NULL,
  [telefono] VARCHAR(50) NULL,
  [calle] VARCHAR(255) NULL,
  [numero_exterior] VARCHAR(50) NULL,
  [numero_interior] VARCHAR(50) NULL,
  [colonia] VARCHAR(255) NULL,
  [ciudad] VARCHAR(255) NULL,
  [estado] VARCHAR(255) NULL,
  [codigo_postal] VARCHAR(20) NULL,
  [pais] VARCHAR(100) NULL DEFAULT ('México'),
  [regimen_fiscal] INT NOT NULL,
  [activa] BIT NULL DEFAULT ((1)),
  [fecha_creacion] DATETIME NULL DEFAULT (getdate()),
  [fecha_actualizacion] DATETIME NULL DEFAULT (getdate()),
  [IdFacturapi] VARCHAR(255) NULL,
  [csd_cer_hash] NVARCHAR(255) NULL,
  [csd_key_hash] NVARCHAR(255) NULL,
  [facturapi_key] VARCHAR(255) NULL
);

ALTER TABLE [configuracion_organizacion] ADD CONSTRAINT [PK__configur__3213E83F6507D907] PRIMARY KEY ([id]);

-- ----------------------------------------
-- Table: ConfiguracionCobranza
-- ----------------------------------------
CREATE TABLE [ConfiguracionCobranza] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [OrganizacionId] INT NOT NULL,
  [DiasGracia] INT NULL DEFAULT ((3)),
  [EscalamientoDias] NVARCHAR(500) NULL,
  [EnvioAutomaticoRecordatorios] BIT NULL DEFAULT ((0)),
  [DiasRecordatorioPrevio] INT NULL DEFAULT ((3))
);

ALTER TABLE [ConfiguracionCobranza] ADD CONSTRAINT [PK__Configur__3214EC07A1A650F3] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: DatosFacturacionSuscripcion
-- ----------------------------------------
CREATE TABLE [DatosFacturacionSuscripcion] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [OrganizacionId] INT NOT NULL,
  [RequiereFactura] BIT NOT NULL DEFAULT ((0)),
  [RFC] NVARCHAR(13) NOT NULL,
  [RazonSocial] NVARCHAR(255) NOT NULL,
  [RegimenFiscalId] INT NOT NULL,
  [UsoCFDI] NVARCHAR(10) NOT NULL DEFAULT ('G03'),
  [Correo] NVARCHAR(255) NOT NULL,
  [CodigoPostal] NVARCHAR(5) NOT NULL,
  [CreatedAt] DATETIME NOT NULL DEFAULT (getdate()),
  [UpdatedAt] DATETIME NOT NULL DEFAULT (getdate())
);

ALTER TABLE [DatosFacturacionSuscripcion] ADD CONSTRAINT [PK__DatosFac__3214EC07DAEFD2CC] PRIMARY KEY ([Id]);
ALTER TABLE [DatosFacturacionSuscripcion] ADD CONSTRAINT [UQ_DatosFacturacion_Org] UNIQUE ([OrganizacionId]);

-- ----------------------------------------
-- Table: Estados
-- ----------------------------------------
CREATE TABLE [Estados] (
  [ID] INT IDENTITY(1,1) NOT NULL,
  [ClaveEstado] VARCHAR(5) NOT NULL,
  [NombreEstado] VARCHAR(100) NOT NULL,
  [PaisID] INT NOT NULL
);

ALTER TABLE [Estados] ADD CONSTRAINT [PK__Estados__3214EC27BA356E07] PRIMARY KEY ([ID]);

-- ----------------------------------------
-- Table: estados_factura
-- ----------------------------------------
CREATE TABLE [estados_factura] (
  [id] INT IDENTITY(1,1) NOT NULL,
  [codigo] VARCHAR(50) NOT NULL
);

ALTER TABLE [estados_factura] ADD CONSTRAINT [PK__estados___3213E83FF4C41AF6] PRIMARY KEY ([id]);
ALTER TABLE [estados_factura] ADD CONSTRAINT [UQ__estados___40F9A2060B6BB5FB] UNIQUE ([codigo]);

-- ----------------------------------------
-- Table: FacturaEnvios
-- ----------------------------------------
CREATE TABLE [FacturaEnvios] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [FacturaId] INT NOT NULL,
  [OrganizacionId] INT NOT NULL,
  [ClienteId] INT NOT NULL,
  [Canal] NVARCHAR(20) NULL,
  [EstadoEnvio] NVARCHAR(50) NULL,
  [MensajeError] NVARCHAR(MAX) NULL,
  [FechaCreacion] DATETIME NULL DEFAULT (getdate()),
  [FechaEnvio] DATETIME NULL,
  [IdMensajeWhatsApp] NVARCHAR(100) NULL
);

ALTER TABLE [FacturaEnvios] ADD CONSTRAINT [PK__FacturaE__3214EC072428EB59] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: Facturas
-- ----------------------------------------
CREATE TABLE [Facturas] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [ClienteId] INT NOT NULL,
  [MontoTotal] DECIMAL(18, 2) NOT NULL,
  [FechaEmision] DATETIME NOT NULL DEFAULT (getdate()),
  [FechaVencimiento] DATETIME NOT NULL,
  [CreatedAt] DATETIME NOT NULL DEFAULT (getdate()),
  [SaldoPendiente] DECIMAL(18, 2) NULL,
  [DiasVencido] INT NULL DEFAULT ((0)),
  [UltimaGestion] DATETIME NULL,
  [Observaciones] NVARCHAR(MAX) NULL,
  [estado_factura_id] INT NULL,
  [prioridad_cobranza_id] INT NULL,
  [numero_factura] VARCHAR(50) NULL,
  [FechaUltimoPago] DATE NULL,
  [RecurrenciaActiva] BIT NULL DEFAULT ((0)),
  [OrdenRecurrencia] NVARCHAR(50) NULL,
  [IdentificadorRecurrencia] NVARCHAR(100) NULL,
  [FechaInicioRecurrencia] DATE NULL,
  [FechaPrimeraFactura] DATE NULL,
  [PeriodoRecurrencia] NVARCHAR(20) NULL,
  [DiaRecurrencia] NVARCHAR(10) NULL,
  [CadaRecurrencia] NVARCHAR(20) NULL,
  [FinRecurrencia] NVARCHAR(20) NULL,
  [FechaFinRecurrencia] DATE NULL,
  [NumeroOcurrencias] INT NULL,
  [OrdenCompra] NVARCHAR(100) NULL,
  [Moneda] NVARCHAR(10) NULL DEFAULT ('MXN'),
  [TipoCambio] DECIMAL(10, 4) NULL DEFAULT ((1.0000)),
  [CondicionesPago] NVARCHAR(50) NULL,
  [NotasCliente] NVARCHAR(MAX) NULL,
  [NotasInternas] NVARCHAR(MAX) NULL,
  [UUIDFacturapi] NVARCHAR(100) NULL,
  [PDFUrl] NVARCHAR(500) NULL,
  [XMLUrl] NVARCHAR(500) NULL,
  [DesglosarImpuestos] BIT NULL DEFAULT ((1)),
  [Identificador] NVARCHAR(100) NULL,
  [MetodoPago] NVARCHAR(10) NULL DEFAULT ('PUE'),
  [UsuarioCreadorId] INT NULL,
  [FormaPago] NVARCHAR(10) NULL DEFAULT ('99'),
  [UUID] NVARCHAR(100) NULL,
  [Timbrado] BIT NULL DEFAULT ((0)),
  [FechaTimbrado] DATETIME NULL,
  [FacturapiId] NVARCHAR(100) NULL,
  [UsoCFDI] NVARCHAR(10) NULL,
  [PDFBase64] NVARCHAR(MAX) NULL,
  [XMLBase64] NVARCHAR(MAX) NULL,
  [AgenteIAActivo] BIT NOT NULL DEFAULT ((0)),
  [MotivoCancelacion] NVARCHAR(10) NULL,
  [MotivoCancelacionDescripcion] NVARCHAR(255) NULL,
  [EstadoCancelacion] NVARCHAR(20) NULL,
  [FacturaSustitucionId] NVARCHAR(100) NULL,
  [FechaCancelacion] DATETIME NULL,
  [UltimaFacturaGenerada] DATETIME NULL,
  [FacturasGeneradas] INT NULL DEFAULT ((0)),
  [EnviarPorCorreo] BIT NULL DEFAULT ((0)),
  [EnviarPorWhatsApp] BIT NULL DEFAULT ((0)),
  [FacturaOrigenId] INT NULL
);

ALTER TABLE [Facturas] ADD CONSTRAINT [PK__Facturas__3214EC07B91F8402] PRIMARY KEY ([Id]);
ALTER TABLE [Facturas] ADD CONSTRAINT [UQ_facturas_numero_factura] UNIQUE ([numero_factura]);

-- ----------------------------------------
-- Table: GestionesCobranza
-- ----------------------------------------
CREATE TABLE [GestionesCobranza] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [FacturaId] INT NOT NULL,
  [UsuarioId] INT NOT NULL,
  [TipoGestion] NVARCHAR(50) NULL,
  [Resultado] NVARCHAR(50) NULL,
  [Descripcion] NVARCHAR(MAX) NULL,
  [FechaGestion] DATETIME NULL DEFAULT (getdate()),
  [FechaProximaGestion] DATETIME NULL,
  [PromesaPagoFecha] DATETIME NULL,
  [PromesaPagoMonto] DECIMAL(18, 2) NULL,
  [RequiereSeguimiento] BIT NULL DEFAULT ((0)),
  [ComprobantePagoRecibido] BIT NOT NULL DEFAULT ((0)),
  [PagoConfirmado] BIT NOT NULL DEFAULT ((0)),
  [MotivoEscalamiento] NVARCHAR(500) NULL
);

ALTER TABLE [GestionesCobranza] ADD CONSTRAINT [PK__Gestione__3214EC075035CC21] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: ImpuestosConcepto
-- ----------------------------------------
CREATE TABLE [ImpuestosConcepto] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [ConceptoId] INT NOT NULL,
  [Tipo] NVARCHAR(50) NOT NULL,
  [Tasa] DECIMAL(5, 4) NOT NULL,
  [Monto] DECIMAL(18, 2) NOT NULL
);

ALTER TABLE [ImpuestosConcepto] ADD CONSTRAINT [PK__Impuesto__3214EC07AE49E229] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: Organizaciones
-- ----------------------------------------
CREATE TABLE [Organizaciones] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [RFC] NVARCHAR(13) NOT NULL,
  [RazonSocial] NVARCHAR(200) NOT NULL,
  [CreatedAt] DATETIME NULL DEFAULT (getdate()),
  [UpdatedAt] DATETIME NULL DEFAULT (getdate()),
  [CorreoElectronico] NVARCHAR(150) NULL,
  [Nombre] NVARCHAR(200) NULL,
  [IdFacturaAPI] NVARCHAR(100) NULL,
  [ApiKeyFacturaAPI] NVARCHAR(100) NULL,
  [FechaActualizacionApiKey] DATETIME NULL
);

ALTER TABLE [Organizaciones] ADD CONSTRAINT [PK__Organiza__3214EC072CC718B0] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: Organizaciones_BaileysSession
-- ----------------------------------------
CREATE TABLE [Organizaciones_BaileysSession] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [OrganizacionId] INT NOT NULL,
  [TelefonoWhatsApp] NVARCHAR(20) NOT NULL,
  [SessionName] NVARCHAR(100) NOT NULL,
  [SesionData] NVARCHAR(MAX) NULL,
  [Activo] BIT NULL DEFAULT ((1)),
  [FechaConfiguracion] DATETIME NULL DEFAULT (getdate()),
  [UltimaActividad] DATETIME NULL,
  [Estado] NVARCHAR(50) NULL DEFAULT ('pendiente')
);

ALTER TABLE [Organizaciones_BaileysSession] ADD CONSTRAINT [PK__Organiza__3214EC07E203E0BB] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: Pagos
-- ----------------------------------------
CREATE TABLE [Pagos] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [FacturaId] INT NOT NULL,
  [UsuarioId] INT NOT NULL,
  [Monto] DECIMAL(18, 2) NOT NULL,
  [FechaPago] DATETIME NOT NULL DEFAULT (getdate()),
  [Metodo] NVARCHAR(50) NOT NULL,
  [CreatedAt] DATETIME NOT NULL DEFAULT (getdate()),
  [UpdatedAt] DATETIME NOT NULL DEFAULT (getdate()),
  [FacturapiPagoId] NVARCHAR(255) NULL,
  [UUIDPago] NVARCHAR(255) NULL,
  [Cancelado] BIT NOT NULL DEFAULT ((0)),
  [FechaCancelacion] DATETIME NULL,
  [MotivoCancelacion] NVARCHAR(10) NULL,
  [ComprobanteBase64] NVARCHAR(MAX) NULL,
  [ComprobanteMimetype] NVARCHAR(50) NULL,
  [TokenComprobante] NVARCHAR(64) NULL,
  [TokenExpiracion] DATETIME NULL
);

ALTER TABLE [Pagos] ADD CONSTRAINT [PK__Pagos__3214EC07D161A3FF] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: PagosSuscripcion
-- ----------------------------------------
CREATE TABLE [PagosSuscripcion] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [SuscripcionId] INT NOT NULL,
  [StripeInvoiceId] NVARCHAR(255) NULL,
  [StripePaymentIntentId] NVARCHAR(255) NULL,
  [Monto] DECIMAL(18, 2) NOT NULL,
  [Moneda] NVARCHAR(10) NOT NULL DEFAULT ('mxn'),
  [Estado] NVARCHAR(50) NOT NULL,
  [FechaPago] DATETIME NOT NULL DEFAULT (getdate()),
  [UrlRecibo] NVARCHAR(500) NULL
);

ALTER TABLE [PagosSuscripcion] ADD CONSTRAINT [PK__PagosSus__3214EC0705792436] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: Paises
-- ----------------------------------------
CREATE TABLE [Paises] (
  [ID] INT IDENTITY(1,1) NOT NULL,
  [NombrePais] VARCHAR(100) NOT NULL
);

ALTER TABLE [Paises] ADD CONSTRAINT [PK__Paises__3214EC279DB2E97B] PRIMARY KEY ([ID]);

-- ----------------------------------------
-- Table: prioridades_cobranza
-- ----------------------------------------
CREATE TABLE [prioridades_cobranza] (
  [id] INT IDENTITY(1,1) NOT NULL,
  [codigo] VARCHAR(50) NOT NULL
);

ALTER TABLE [prioridades_cobranza] ADD CONSTRAINT [PK__priorida__3213E83FA59491E1] PRIMARY KEY ([id]);
ALTER TABLE [prioridades_cobranza] ADD CONSTRAINT [UQ__priorida__40F9A206B07E5947] UNIQUE ([codigo]);

-- ----------------------------------------
-- Table: Recordatorios
-- ----------------------------------------
CREATE TABLE [Recordatorios] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [FacturaId] INT NOT NULL,
  [TipoMensaje] VARCHAR(50) NOT NULL,
  [Destinatario] VARCHAR(255) NOT NULL,
  [CC] VARCHAR(500) NULL,
  [Asunto] VARCHAR(500) NULL,
  [Mensaje] TEXT NULL,
  [FechaEnvio] DATETIME NOT NULL DEFAULT (getdate()),
  [Visto] BIT NOT NULL DEFAULT ((0)),
  [FechaVisto] DATETIME NULL,
  [MetodoEnvio] VARCHAR(50) NOT NULL DEFAULT ('Manual'),
  [Estado] VARCHAR(50) NOT NULL DEFAULT ('Enviado'),
  [MessageId] VARCHAR(500) NULL,
  [ErrorMessage] TEXT NULL,
  [CreadoPor] INT NULL
);

ALTER TABLE [Recordatorios] ADD CONSTRAINT [PK__Recordat__3214EC0766DDD961] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: RecordatoriosProgramados
-- ----------------------------------------
CREATE TABLE [RecordatoriosProgramados] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [ClienteId] INT NOT NULL,
  [FacturaId] INT NULL,
  [TipoRecordatorio] NVARCHAR(50) NULL,
  [FechaEnvio] DATETIME NULL,
  [Mensaje] NVARCHAR(MAX) NULL,
  [Estado] NVARCHAR(50) NULL DEFAULT ('pendiente')
);

ALTER TABLE [RecordatoriosProgramados] ADD CONSTRAINT [PK__Recordat__3214EC07CE1BB57C] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: Regimen
-- ----------------------------------------
CREATE TABLE [Regimen] (
  [ID_Regimen] INT IDENTITY(1,1) NOT NULL,
  [Codigo] SMALLINT NOT NULL,
  [Descripcion] NVARCHAR(250) NOT NULL
);

ALTER TABLE [Regimen] ADD CONSTRAINT [PK_Regimen] PRIMARY KEY ([ID_Regimen]);

-- ----------------------------------------
-- Table: Roles
-- ----------------------------------------
CREATE TABLE [Roles] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [Nombre] NVARCHAR(100) NOT NULL
);

ALTER TABLE [Roles] ADD CONSTRAINT [PK__Roles__3214EC07BBD5A877] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: Suscripciones
-- ----------------------------------------
CREATE TABLE [Suscripciones] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [OrganizacionId] INT NOT NULL,
  [StripeCustomerId] NVARCHAR(255) NULL,
  [StripeSubscriptionId] NVARCHAR(255) NULL,
  [StripePriceId] NVARCHAR(255) NULL,
  [PlanSeleccionado] NVARCHAR(50) NOT NULL DEFAULT ('free'),
  [Estado] NVARCHAR(50) NOT NULL DEFAULT ('active'),
  [FechaInicio] DATETIME NOT NULL DEFAULT (getdate()),
  [FechaFinPeriodo] DATETIME NULL,
  [FechaCancelacion] DATETIME NULL,
  [TrialEnd] DATETIME NULL,
  [CreatedAt] DATETIME NOT NULL DEFAULT (getdate()),
  [UpdatedAt] DATETIME NOT NULL DEFAULT (getdate()),
  [MotivoCancelacion] NVARCHAR(500) NULL
);

ALTER TABLE [Suscripciones] ADD CONSTRAINT [PK__Suscripc__3214EC076C6E7FBC] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: Usuario_Organizacion
-- ----------------------------------------
CREATE TABLE [Usuario_Organizacion] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [UsuarioId] INT NOT NULL,
  [OrganizacionId] INT NOT NULL,
  [RolId] INT NOT NULL,
  [CreatedAt] DATETIME NULL DEFAULT (getdate()),
  [UpdatedAt] DATETIME NULL DEFAULT (getdate()),
  [FechaAsignacion] DATETIME NULL DEFAULT (getdate())
);

ALTER TABLE [Usuario_Organizacion] ADD CONSTRAINT [PK__Usuario___3214EC07D75CF6A9] PRIMARY KEY ([Id]);

-- ----------------------------------------
-- Table: Usuarios
-- ----------------------------------------
CREATE TABLE [Usuarios] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [Correo] NVARCHAR(150) NOT NULL,
  [Contrasena] NVARCHAR(200) NOT NULL,
  [NumeroTel] NVARCHAR(20) NULL,
  [Activo] BIT NULL DEFAULT ((1)),
  [Nombre] NVARCHAR(50) NULL,
  [Apellido] NVARCHAR(50) NULL,
  [google_id] NVARCHAR(255) NULL,
  [foto_url] NVARCHAR(500) NULL,
  [provider] VARCHAR(50) NULL DEFAULT ('email'),
  [email_verified] BIT NOT NULL DEFAULT ((0)),
  [verification_token] NVARCHAR(255) NULL,
  [verification_expires] DATETIME NULL,
  [password_reset_token] NVARCHAR(255) NULL,
  [password_reset_expires] DATETIME NULL,
  [plan_id] NVARCHAR(50) NULL DEFAULT ('FREE')
);

ALTER TABLE [Usuarios] ADD CONSTRAINT [PK__Usuarios__3214EC07E1F76580] PRIMARY KEY ([Id]);
ALTER TABLE [Usuarios] ADD CONSTRAINT [UQ__Usuarios__60695A191846C523] UNIQUE ([Correo]);

-- ----------------------------------------
-- Foreign Keys
-- ----------------------------------------
ALTER TABLE [Agentes_Clientes] ADD CONSTRAINT [FK_AgenteCliente_Cliente] FOREIGN KEY ([ClienteId]) REFERENCES [Clientes]([Id]);
ALTER TABLE [Agentes_Clientes] ADD CONSTRAINT [FK_AgenteCliente_Usuario] FOREIGN KEY ([UsuarioId]) REFERENCES [Usuarios]([Id]);
ALTER TABLE [audit_log] ADD CONSTRAINT [FK__audit_log__organ__7FEAFD3E] FOREIGN KEY ([organizacion_id]) REFERENCES [Organizaciones]([Id]) ON DELETE CASCADE;
ALTER TABLE [audit_log] ADD CONSTRAINT [FK__audit_log__usuar__7E02B4CC] FOREIGN KEY ([usuario_id]) REFERENCES [Usuarios]([Id]);
ALTER TABLE [auditoria_intentos_registro] ADD CONSTRAINT [FK__auditoria__Usuar__7A3223E8] FOREIGN KEY ([UsuarioId]) REFERENCES [Usuarios]([Id]);
ALTER TABLE [Clientes] ADD CONSTRAINT [FK_Clientes_Estado] FOREIGN KEY ([EstadoId]) REFERENCES [Estados]([ID]);
ALTER TABLE [Clientes] ADD CONSTRAINT [FK_Clientes_Organizacion] FOREIGN KEY ([OrganizacionId]) REFERENCES [Organizaciones]([Id]);
ALTER TABLE [Clientes] ADD CONSTRAINT [FK_Clientes_Pais] FOREIGN KEY ([PaisId]) REFERENCES [Paises]([ID]);
ALTER TABLE [Clientes] ADD CONSTRAINT [FK_Clientes_Regimen] FOREIGN KEY ([RegimenFiscalId]) REFERENCES [Regimen]([ID_Regimen]);
ALTER TABLE [ComprobantesRecibidos] ADD CONSTRAINT [FK_ComprobantesRecibidos_Facturas] FOREIGN KEY ([FacturaId]) REFERENCES [Facturas]([Id]);
ALTER TABLE [ComprobantesRecibidos] ADD CONSTRAINT [FK_ComprobantesRecibidos_Organizaciones] FOREIGN KEY ([OrganizacionId]) REFERENCES [Organizaciones]([Id]);
ALTER TABLE [ConceptosFactura] ADD CONSTRAINT [FK_ConceptosFactura_Factura] FOREIGN KEY ([FacturaId]) REFERENCES [Facturas]([Id]) ON DELETE CASCADE;
ALTER TABLE [configuracion_organizacion] ADD CONSTRAINT [fk_organizacion] FOREIGN KEY ([organizacion_id]) REFERENCES [Organizaciones]([Id]);
ALTER TABLE [configuracion_organizacion] ADD CONSTRAINT [fk_regimen] FOREIGN KEY ([regimen_fiscal]) REFERENCES [Regimen]([ID_Regimen]);
ALTER TABLE [ConfiguracionCobranza] ADD CONSTRAINT [FK_ConfiguracionCobranza_Organizacion] FOREIGN KEY ([OrganizacionId]) REFERENCES [Organizaciones]([Id]);
ALTER TABLE [DatosFacturacionSuscripcion] ADD CONSTRAINT [FK_DatosFacturacion_Organizacion] FOREIGN KEY ([OrganizacionId]) REFERENCES [Organizaciones]([Id]);
ALTER TABLE [DatosFacturacionSuscripcion] ADD CONSTRAINT [FK_DatosFacturacion_Regimen] FOREIGN KEY ([RegimenFiscalId]) REFERENCES [Regimen]([ID_Regimen]);
ALTER TABLE [Estados] ADD CONSTRAINT [FK__Estados__PaisID__0D7A0286] FOREIGN KEY ([PaisID]) REFERENCES [Paises]([ID]);
ALTER TABLE [Facturas] ADD CONSTRAINT [FK_Facturas_Clientes] FOREIGN KEY ([ClienteId]) REFERENCES [Clientes]([Id]);
ALTER TABLE [Facturas] ADD CONSTRAINT [FK_facturas_estado_factura] FOREIGN KEY ([estado_factura_id]) REFERENCES [estados_factura]([id]);
ALTER TABLE [Facturas] ADD CONSTRAINT [FK_Facturas_FacturaOrigen] FOREIGN KEY ([FacturaOrigenId]) REFERENCES [Facturas]([Id]);
ALTER TABLE [Facturas] ADD CONSTRAINT [FK_facturas_prioridad_cobranza] FOREIGN KEY ([prioridad_cobranza_id]) REFERENCES [prioridades_cobranza]([id]);
ALTER TABLE [Facturas] ADD CONSTRAINT [FK_Facturas_UsuarioCreador] FOREIGN KEY ([UsuarioCreadorId]) REFERENCES [Usuarios]([Id]);
ALTER TABLE [GestionesCobranza] ADD CONSTRAINT [FK_GestionesCobranza_Factura] FOREIGN KEY ([FacturaId]) REFERENCES [Facturas]([Id]);
ALTER TABLE [GestionesCobranza] ADD CONSTRAINT [FK_GestionesCobranza_Usuario] FOREIGN KEY ([UsuarioId]) REFERENCES [Usuarios]([Id]);
ALTER TABLE [ImpuestosConcepto] ADD CONSTRAINT [FK_ImpuestosConcepto_Concepto] FOREIGN KEY ([ConceptoId]) REFERENCES [ConceptosFactura]([Id]) ON DELETE CASCADE;
ALTER TABLE [Pagos] ADD CONSTRAINT [FK_Pagos_Facturas] FOREIGN KEY ([FacturaId]) REFERENCES [Facturas]([Id]);
ALTER TABLE [Pagos] ADD CONSTRAINT [FK_Pagos_Usuarios] FOREIGN KEY ([UsuarioId]) REFERENCES [Usuarios]([Id]);
ALTER TABLE [PagosSuscripcion] ADD CONSTRAINT [FK_PagosSuscripcion_Suscripcion] FOREIGN KEY ([SuscripcionId]) REFERENCES [Suscripciones]([Id]);
ALTER TABLE [Recordatorios] ADD CONSTRAINT [FK_Recordatorios_Facturas] FOREIGN KEY ([FacturaId]) REFERENCES [Facturas]([Id]) ON DELETE CASCADE;
ALTER TABLE [Recordatorios] ADD CONSTRAINT [FK_Recordatorios_Usuario] FOREIGN KEY ([CreadoPor]) REFERENCES [Usuarios]([Id]);
ALTER TABLE [RecordatoriosProgramados] ADD CONSTRAINT [FK_RecordatoriosProgramados_Cliente] FOREIGN KEY ([ClienteId]) REFERENCES [Clientes]([Id]);
ALTER TABLE [RecordatoriosProgramados] ADD CONSTRAINT [FK_RecordatoriosProgramados_Factura] FOREIGN KEY ([FacturaId]) REFERENCES [Facturas]([Id]);
ALTER TABLE [Suscripciones] ADD CONSTRAINT [FK_Suscripciones_Organizacion] FOREIGN KEY ([OrganizacionId]) REFERENCES [Organizaciones]([Id]);
ALTER TABLE [Usuario_Organizacion] ADD CONSTRAINT [FK_UsuarioOrganizacion_Organizacion] FOREIGN KEY ([OrganizacionId]) REFERENCES [Organizaciones]([Id]);
ALTER TABLE [Usuario_Organizacion] ADD CONSTRAINT [FK_UsuarioOrganizacion_Rol] FOREIGN KEY ([RolId]) REFERENCES [Roles]([Id]);
ALTER TABLE [Usuario_Organizacion] ADD CONSTRAINT [FK_UsuarioOrganizacion_Usuario] FOREIGN KEY ([UsuarioId]) REFERENCES [Usuarios]([Id]);

-- ----------------------------------------
-- Indexes
-- ----------------------------------------
CREATE INDEX ON [ComprobantesRecibidos] ([Estado]);
CREATE INDEX ON [ComprobantesRecibidos] ([FacturaId]);
CREATE INDEX ON [ComprobantesRecibidos] ([FechaRecepcion]);
CREATE INDEX ON [ComprobantesRecibidos] ([OrganizacionId]);
CREATE INDEX ON [configuracion_organizacion] ([csd_cer_hash]);
CREATE INDEX ON [configuracion_organizacion] ([csd_key_hash]);
CREATE INDEX ON [Facturas] ([FacturaOrigenId]) WHERE ([FacturaOrigenId] IS NOT NULL);
CREATE INDEX ON [Pagos] ([Id]) WHERE ([ComprobanteBase64] IS NOT NULL);
CREATE UNIQUE INDEX ON [Pagos] ([TokenComprobante]) WHERE ([TokenComprobante] IS NOT NULL);
CREATE INDEX ON [PagosSuscripcion] ([SuscripcionId]);
CREATE UNIQUE INDEX ON [Suscripciones] ([OrganizacionId]);
CREATE INDEX ON [Suscripciones] ([StripeCustomerId]);
CREATE INDEX ON [Suscripciones] ([StripeSubscriptionId]);
CREATE UNIQUE INDEX ON [Usuarios] ([google_id]) WHERE ([google_id] IS NOT NULL);

