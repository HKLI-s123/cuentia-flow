-- ============================================
-- PostgreSQL Schema (convertido desde MSSQL)
-- Generated: 2026-04-02T18:59:50.970Z
-- ============================================

-- ----------------------------------------
-- Table: Agentes_Clientes
-- ----------------------------------------
CREATE TABLE "Agentes_Clientes" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "ClienteId" INTEGER NOT NULL,
  "UsuarioId" INTEGER NOT NULL,
  "RolAgente" VARCHAR(100),
  "CreatedAt" TIMESTAMP DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------
-- Table: audit_log
-- ----------------------------------------
CREATE TABLE "audit_log" (
  "id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "organizacion_id" INTEGER NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "details" TEXT,
  "ip_address" VARCHAR(45),
  "timestamp" TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC')
);

-- ----------------------------------------
-- Table: auditoria_intentos_registro
-- ----------------------------------------
CREATE TABLE "auditoria_intentos_registro" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "UsuarioId" INTEGER,
  "RFC" VARCHAR(13),
  "Tipo" VARCHAR(50),
  "Mensaje" VARCHAR(255),
  "Timestamp" TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------
-- Table: Clientes
-- ----------------------------------------
CREATE TABLE "Clientes" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "NombreComercial" VARCHAR(200),
  "RazonSocial" VARCHAR(200) NOT NULL,
  "RFC" VARCHAR(13) NOT NULL,
  "RegimenFiscal" VARCHAR(100),
  "CondicionesPago" VARCHAR(100),
  "CorreoPrincipal" VARCHAR(150),
  "Pais" VARCHAR(100),
  "CodigoPais" VARCHAR(10),
  "Telefono" VARCHAR(20),
  "Estado" VARCHAR(100),
  "Calle" VARCHAR(200),
  "NumeroExterior" VARCHAR(20),
  "NumeroInterior" VARCHAR(20),
  "CodigoPostal" VARCHAR(10),
  "Colonia" VARCHAR(100),
  "Ciudad" VARCHAR(100),
  "OrganizacionId" INTEGER NOT NULL DEFAULT 1,
  "RegimenFiscalId" INTEGER,
  "EstadoId" INTEGER,
  "PaisId" INTEGER,
  "IdClienteFacturaAPI" VARCHAR(50),
  "FechaRegistroFacturaAPI" TIMESTAMP,
  "SincronizadoFacturaAPI" BOOLEAN DEFAULT FALSE,
  "ErrorSincronizacionFacturaAPI" TEXT,
  "TelefonoWhatsApp" VARCHAR(20),
  "AutoComplementoPago" BOOLEAN NOT NULL DEFAULT FALSE
);

-- ----------------------------------------
-- Table: ComprobantesRecibidos
-- ----------------------------------------
CREATE TABLE "ComprobantesRecibidos" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "FacturaId" INTEGER NOT NULL,
  "OrganizacionId" INTEGER NOT NULL,
  "ImagenBase64" TEXT,
  "ImagenMimetype" VARCHAR(50),
  "MontoDetectado" DECIMAL(18, 2),
  "FechaPagoDetectada" DATE,
  "MetodoPagoDetectado" VARCHAR(10),
  "ReferenciaBancaria" VARCHAR(100),
  "BancoOrigen" VARCHAR(100),
  "BancoDestino" VARCHAR(100),
  "DatosExtraidosJSON" TEXT,
  "Estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  "MotivoRechazo" VARCHAR(500),
  "PagoId" INTEGER,
  "FacturapiComplementoId" VARCHAR(255),
  "UUIDComplemento" VARCHAR(255),
  "MensajeTexto" TEXT,
  "TelefonoCliente" VARCHAR(20),
  "FechaRecepcion" TIMESTAMP NOT NULL DEFAULT NOW(),
  "FechaConfirmacion" TIMESTAMP,
  "FechaRechazo" TIMESTAMP,
  "UsuarioConfirmoId" INTEGER,
  "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "RecibidoFueraDeCiclo" BOOLEAN NOT NULL DEFAULT FALSE
);

-- ----------------------------------------
-- Table: ConceptosFactura
-- ----------------------------------------
CREATE TABLE "ConceptosFactura" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "FacturaId" INTEGER NOT NULL,
  "Nombre" VARCHAR(255) NOT NULL,
  "Descripcion" VARCHAR(500),
  "ClaveProdServ" VARCHAR(50),
  "UnidadMedida" VARCHAR(10) NOT NULL,
  "Cantidad" DECIMAL(18, 2) NOT NULL,
  "PrecioUnitario" DECIMAL(18, 2) NOT NULL,
  "Subtotal" DECIMAL(18, 2) NOT NULL,
  "MonedaProducto" VARCHAR(10),
  "ObjetoImpuesto" VARCHAR(10),
  "TotalImpuestos" DECIMAL(18, 2) DEFAULT 0,
  "Total" DECIMAL(18, 2) NOT NULL
);

-- ----------------------------------------
-- Table: configuracion_organizacion
-- ----------------------------------------
CREATE TABLE "configuracion_organizacion" (
  "id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "organizacion_id" INTEGER NOT NULL,
  "nombre_comercial" VARCHAR(255),
  "email_corporativo" VARCHAR(255),
  "telefono" VARCHAR(50),
  "calle" VARCHAR(255),
  "numero_exterior" VARCHAR(50),
  "numero_interior" VARCHAR(50),
  "colonia" VARCHAR(255),
  "ciudad" VARCHAR(255),
  "estado" VARCHAR(255),
  "codigo_postal" VARCHAR(20),
  "pais" VARCHAR(100) DEFAULT 'México',
  "regimen_fiscal" INTEGER NOT NULL,
  "activa" BOOLEAN DEFAULT TRUE,
  "fecha_creacion" TIMESTAMP DEFAULT NOW(),
  "fecha_actualizacion" TIMESTAMP DEFAULT NOW(),
  "IdFacturapi" VARCHAR(255),
  "csd_cer_hash" VARCHAR(255),
  "csd_key_hash" VARCHAR(255),
  "facturapi_key" VARCHAR(255)
);

-- ----------------------------------------
-- Table: ConfiguracionCobranza
-- ----------------------------------------
CREATE TABLE "ConfiguracionCobranza" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "OrganizacionId" INTEGER NOT NULL,
  "DiasGracia" INTEGER DEFAULT 3,
  "EscalamientoDias" VARCHAR(500),
  "EnvioAutomaticoRecordatorios" BOOLEAN DEFAULT FALSE,
  "DiasRecordatorioPrevio" INTEGER DEFAULT 3
);

-- ----------------------------------------
-- Table: DatosFacturacionSuscripcion
-- ----------------------------------------
CREATE TABLE "DatosFacturacionSuscripcion" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "OrganizacionId" INTEGER NOT NULL,
  "RequiereFactura" BOOLEAN NOT NULL DEFAULT FALSE,
  "RFC" VARCHAR(13) NOT NULL,
  "RazonSocial" VARCHAR(255) NOT NULL,
  "RegimenFiscalId" INTEGER NOT NULL,
  "UsoCFDI" VARCHAR(10) NOT NULL DEFAULT 'G03',
  "Correo" VARCHAR(255) NOT NULL,
  "CodigoPostal" VARCHAR(5) NOT NULL,
  "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ----------------------------------------
-- Table: Estados
-- ----------------------------------------
CREATE TABLE "Estados" (
  "ID" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "ClaveEstado" VARCHAR(5) NOT NULL,
  "NombreEstado" VARCHAR(100) NOT NULL,
  "PaisID" INTEGER NOT NULL
);

-- ----------------------------------------
-- Table: estados_factura
-- ----------------------------------------
CREATE TABLE "estados_factura" (
  "id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "codigo" VARCHAR(50) NOT NULL
);

-- ----------------------------------------
-- Table: FacturaEnvios
-- ----------------------------------------
CREATE TABLE "FacturaEnvios" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "FacturaId" INTEGER NOT NULL,
  "OrganizacionId" INTEGER NOT NULL,
  "ClienteId" INTEGER NOT NULL,
  "Canal" VARCHAR(20),
  "EstadoEnvio" VARCHAR(50),
  "MensajeError" TEXT,
  "FechaCreacion" TIMESTAMP DEFAULT NOW(),
  "FechaEnvio" TIMESTAMP,
  "IdMensajeWhatsApp" VARCHAR(100)
);

-- ----------------------------------------
-- Table: Facturas
-- ----------------------------------------
CREATE TABLE "Facturas" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "ClienteId" INTEGER NOT NULL,
  "MontoTotal" DECIMAL(18, 2) NOT NULL,
  "FechaEmision" TIMESTAMP NOT NULL DEFAULT NOW(),
  "FechaVencimiento" TIMESTAMP NOT NULL,
  "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "SaldoPendiente" DECIMAL(18, 2),
  "DiasVencido" INTEGER DEFAULT 0,
  "UltimaGestion" TIMESTAMP,
  "Observaciones" TEXT,
  "estado_factura_id" INTEGER,
  "prioridad_cobranza_id" INTEGER,
  "numero_factura" VARCHAR(50),
  "FechaUltimoPago" DATE,
  "RecurrenciaActiva" BOOLEAN DEFAULT FALSE,
  "OrdenRecurrencia" VARCHAR(50),
  "IdentificadorRecurrencia" VARCHAR(100),
  "FechaInicioRecurrencia" DATE,
  "FechaPrimeraFactura" DATE,
  "PeriodoRecurrencia" VARCHAR(20),
  "DiaRecurrencia" VARCHAR(10),
  "CadaRecurrencia" VARCHAR(20),
  "FinRecurrencia" VARCHAR(20),
  "FechaFinRecurrencia" DATE,
  "NumeroOcurrencias" INTEGER,
  "OrdenCompra" VARCHAR(100),
  "Moneda" VARCHAR(10) DEFAULT 'MXN',
  "TipoCambio" DECIMAL(10, 4) DEFAULT 1.0000,
  "CondicionesPago" VARCHAR(50),
  "NotasCliente" TEXT,
  "NotasInternas" TEXT,
  "UUIDFacturapi" VARCHAR(100),
  "PDFUrl" VARCHAR(500),
  "XMLUrl" VARCHAR(500),
  "DesglosarImpuestos" BOOLEAN DEFAULT TRUE,
  "Identificador" VARCHAR(100),
  "MetodoPago" VARCHAR(10) DEFAULT 'PUE',
  "UsuarioCreadorId" INTEGER,
  "FormaPago" VARCHAR(10) DEFAULT '99',
  "UUID" VARCHAR(100),
  "Timbrado" BOOLEAN DEFAULT FALSE,
  "FechaTimbrado" TIMESTAMP,
  "FacturapiId" VARCHAR(100),
  "UsoCFDI" VARCHAR(10),
  "PDFBase64" TEXT,
  "XMLBase64" TEXT,
  "AgenteIAActivo" BOOLEAN NOT NULL DEFAULT FALSE,
  "MotivoCancelacion" VARCHAR(10),
  "MotivoCancelacionDescripcion" VARCHAR(255),
  "EstadoCancelacion" VARCHAR(20),
  "FacturaSustitucionId" VARCHAR(100),
  "FechaCancelacion" TIMESTAMP,
  "UltimaFacturaGenerada" TIMESTAMP,
  "FacturasGeneradas" INTEGER DEFAULT 0,
  "EnviarPorCorreo" BOOLEAN DEFAULT FALSE,
  "EnviarPorWhatsApp" BOOLEAN DEFAULT FALSE,
  "FacturaOrigenId" INTEGER
);

-- ----------------------------------------
-- Table: GestionesCobranza
-- ----------------------------------------
CREATE TABLE "GestionesCobranza" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "FacturaId" INTEGER NOT NULL,
  "UsuarioId" INTEGER NOT NULL,
  "TipoGestion" VARCHAR(50),
  "Resultado" VARCHAR(50),
  "Descripcion" TEXT,
  "FechaGestion" TIMESTAMP DEFAULT NOW(),
  "FechaProximaGestion" TIMESTAMP,
  "PromesaPagoFecha" TIMESTAMP,
  "PromesaPagoMonto" DECIMAL(18, 2),
  "RequiereSeguimiento" BOOLEAN DEFAULT FALSE,
  "ComprobantePagoRecibido" BOOLEAN NOT NULL DEFAULT FALSE,
  "PagoConfirmado" BOOLEAN NOT NULL DEFAULT FALSE,
  "MotivoEscalamiento" VARCHAR(500)
);

-- ----------------------------------------
-- Table: ImpuestosConcepto
-- ----------------------------------------
CREATE TABLE "ImpuestosConcepto" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "ConceptoId" INTEGER NOT NULL,
  "Tipo" VARCHAR(50) NOT NULL,
  "Tasa" DECIMAL(5, 4) NOT NULL,
  "Monto" DECIMAL(18, 2) NOT NULL
);

-- ----------------------------------------
-- Table: Organizaciones
-- ----------------------------------------
CREATE TABLE "Organizaciones" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "RFC" VARCHAR(13) NOT NULL,
  "RazonSocial" VARCHAR(200) NOT NULL,
  "CreatedAt" TIMESTAMP DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP DEFAULT NOW(),
  "CorreoElectronico" VARCHAR(150),
  "Nombre" VARCHAR(200),
  "IdFacturaAPI" VARCHAR(100),
  "ApiKeyFacturaAPI" VARCHAR(100),
  "FechaActualizacionApiKey" TIMESTAMP
);

-- ----------------------------------------
-- Table: Organizaciones_BaileysSession
-- ----------------------------------------
CREATE TABLE "Organizaciones_BaileysSession" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "OrganizacionId" INTEGER NOT NULL,
  "TelefonoWhatsApp" VARCHAR(20) NOT NULL,
  "SessionName" VARCHAR(100) NOT NULL,
  "SesionData" TEXT,
  "Activo" BOOLEAN DEFAULT TRUE,
  "FechaConfiguracion" TIMESTAMP DEFAULT NOW(),
  "UltimaActividad" TIMESTAMP,
  "Estado" VARCHAR(50) DEFAULT 'pendiente'
);

-- ----------------------------------------
-- Table: Pagos
-- ----------------------------------------
CREATE TABLE "Pagos" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "FacturaId" INTEGER NOT NULL,
  "UsuarioId" INTEGER NOT NULL,
  "Monto" DECIMAL(18, 2) NOT NULL,
  "FechaPago" TIMESTAMP NOT NULL DEFAULT NOW(),
  "Metodo" VARCHAR(50) NOT NULL,
  "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "FacturapiPagoId" VARCHAR(255),
  "UUIDPago" VARCHAR(255),
  "Cancelado" BOOLEAN NOT NULL DEFAULT FALSE,
  "FechaCancelacion" TIMESTAMP,
  "MotivoCancelacion" VARCHAR(10),
  "ComprobanteBase64" TEXT,
  "ComprobanteMimetype" VARCHAR(50),
  "TokenComprobante" VARCHAR(64),
  "TokenExpiracion" TIMESTAMP
);

-- ----------------------------------------
-- Table: PagosSuscripcion
-- ----------------------------------------
CREATE TABLE "PagosSuscripcion" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "SuscripcionId" INTEGER NOT NULL,
  "StripeInvoiceId" VARCHAR(255),
  "StripePaymentIntentId" VARCHAR(255),
  "Monto" DECIMAL(18, 2) NOT NULL,
  "Moneda" VARCHAR(10) NOT NULL DEFAULT 'mxn',
  "Estado" VARCHAR(50) NOT NULL,
  "FechaPago" TIMESTAMP NOT NULL DEFAULT NOW(),
  "UrlRecibo" VARCHAR(500)
);

-- ----------------------------------------
-- Table: Paises
-- ----------------------------------------
CREATE TABLE "Paises" (
  "ID" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "NombrePais" VARCHAR(100) NOT NULL
);

-- ----------------------------------------
-- Table: prioridades_cobranza
-- ----------------------------------------
CREATE TABLE "prioridades_cobranza" (
  "id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "codigo" VARCHAR(50) NOT NULL
);

-- ----------------------------------------
-- Table: Recordatorios
-- ----------------------------------------
CREATE TABLE "Recordatorios" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "FacturaId" INTEGER NOT NULL,
  "TipoMensaje" VARCHAR(50) NOT NULL,
  "Destinatario" VARCHAR(255) NOT NULL,
  "CC" VARCHAR(500),
  "Asunto" VARCHAR(500),
  "Mensaje" TEXT,
  "FechaEnvio" TIMESTAMP NOT NULL DEFAULT NOW(),
  "Visto" BOOLEAN NOT NULL DEFAULT FALSE,
  "FechaVisto" TIMESTAMP,
  "MetodoEnvio" VARCHAR(50) NOT NULL DEFAULT 'Manual',
  "Estado" VARCHAR(50) NOT NULL DEFAULT 'Enviado',
  "MessageId" VARCHAR(500),
  "ErrorMessage" TEXT,
  "CreadoPor" INTEGER
);

-- ----------------------------------------
-- Table: RecordatoriosProgramados
-- ----------------------------------------
CREATE TABLE "RecordatoriosProgramados" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "ClienteId" INTEGER NOT NULL,
  "FacturaId" INTEGER,
  "TipoRecordatorio" VARCHAR(50),
  "FechaEnvio" TIMESTAMP,
  "Mensaje" TEXT,
  "Estado" VARCHAR(50) DEFAULT 'pendiente'
);

-- ----------------------------------------
-- Table: Regimen
-- ----------------------------------------
CREATE TABLE "Regimen" (
  "ID_Regimen" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "Codigo" SMALLINT NOT NULL,
  "Descripcion" VARCHAR(250) NOT NULL
);

-- ----------------------------------------
-- Table: Roles
-- ----------------------------------------
CREATE TABLE "Roles" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "Nombre" VARCHAR(100) NOT NULL
);

-- ----------------------------------------
-- Table: Suscripciones
-- ----------------------------------------
CREATE TABLE "Suscripciones" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "OrganizacionId" INTEGER NOT NULL,
  "StripeCustomerId" VARCHAR(255),
  "StripeSubscriptionId" VARCHAR(255),
  "StripePriceId" VARCHAR(255),
  "PlanSeleccionado" VARCHAR(50) NOT NULL DEFAULT 'free',
  "Estado" VARCHAR(50) NOT NULL DEFAULT 'active',
  "FechaInicio" TIMESTAMP NOT NULL DEFAULT NOW(),
  "FechaFinPeriodo" TIMESTAMP,
  "FechaCancelacion" TIMESTAMP,
  "TrialEnd" TIMESTAMP,
  "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "MotivoCancelacion" VARCHAR(500)
);

-- ----------------------------------------
-- Table: tickets_soporte
-- ----------------------------------------
CREATE TABLE "tickets_soporte" (
  "id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "usuarioid" INTEGER NOT NULL,
  "organizacionid" INTEGER,
  "asunto" VARCHAR(200) NOT NULL,
  "categoria" VARCHAR(50) NOT NULL DEFAULT 'general',
  "descripcion" TEXT NOT NULL,
  "estado" VARCHAR(30) NOT NULL DEFAULT 'abierto',
  "createdat" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedat" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ----------------------------------------
-- Table: Usuario_Organizacion
-- ----------------------------------------
CREATE TABLE "Usuario_Organizacion" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "UsuarioId" INTEGER NOT NULL,
  "OrganizacionId" INTEGER NOT NULL,
  "RolId" INTEGER NOT NULL,
  "CreatedAt" TIMESTAMP DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP DEFAULT NOW(),
  "FechaAsignacion" TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------
-- Table: Usuarios
-- ----------------------------------------
CREATE TABLE "Usuarios" (
  "Id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
  "Correo" VARCHAR(150) NOT NULL,
  "Contrasena" VARCHAR(200) NOT NULL,
  "NumeroTel" VARCHAR(20),
  "Activo" BOOLEAN DEFAULT TRUE,
  "Nombre" VARCHAR(50),
  "Apellido" VARCHAR(50),
  "google_id" VARCHAR(255),
  "foto_url" VARCHAR(500),
  "provider" VARCHAR(50) DEFAULT 'email',
  "email_verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "verification_token" VARCHAR(255),
  "verification_expires" TIMESTAMP,
  "password_reset_token" VARCHAR(255),
  "password_reset_expires" TIMESTAMP,
  "plan_id" VARCHAR(50) DEFAULT 'FREE'
);

ALTER TABLE "Agentes_Clientes" ADD CONSTRAINT "PK__Agentes___3214EC07F484DF04" PRIMARY KEY ("Id");
ALTER TABLE "audit_log" ADD CONSTRAINT "PK__audit_lo__3213E83FA6D6A7DA" PRIMARY KEY ("id");
ALTER TABLE "auditoria_intentos_registro" ADD CONSTRAINT "PK__auditori__3214EC07608FB530" PRIMARY KEY ("Id");
ALTER TABLE "Clientes" ADD CONSTRAINT "PK__Clientes__3214EC074E494E72" PRIMARY KEY ("Id");
ALTER TABLE "ComprobantesRecibidos" ADD CONSTRAINT "PK__Comproba__3214EC07F01FB3B9" PRIMARY KEY ("Id");
ALTER TABLE "ConceptosFactura" ADD CONSTRAINT "PK__Concepto__3214EC07CD4C5EEF" PRIMARY KEY ("Id");
ALTER TABLE "configuracion_organizacion" ADD CONSTRAINT "PK__configur__3213E83F6507D907" PRIMARY KEY ("id");
ALTER TABLE "ConfiguracionCobranza" ADD CONSTRAINT "PK__Configur__3214EC07A1A650F3" PRIMARY KEY ("Id");
ALTER TABLE "DatosFacturacionSuscripcion" ADD CONSTRAINT "PK__DatosFac__3214EC07DAEFD2CC" PRIMARY KEY ("Id");
ALTER TABLE "Estados" ADD CONSTRAINT "PK__Estados__3214EC27BA356E07" PRIMARY KEY ("ID");
ALTER TABLE "estados_factura" ADD CONSTRAINT "PK__estados___3213E83FF4C41AF6" PRIMARY KEY ("id");
ALTER TABLE "FacturaEnvios" ADD CONSTRAINT "PK__FacturaE__3214EC072428EB59" PRIMARY KEY ("Id");
ALTER TABLE "Facturas" ADD CONSTRAINT "PK__Facturas__3214EC07B91F8402" PRIMARY KEY ("Id");
ALTER TABLE "GestionesCobranza" ADD CONSTRAINT "PK__Gestione__3214EC075035CC21" PRIMARY KEY ("Id");
ALTER TABLE "ImpuestosConcepto" ADD CONSTRAINT "PK__Impuesto__3214EC07AE49E229" PRIMARY KEY ("Id");
ALTER TABLE "Organizaciones" ADD CONSTRAINT "PK__Organiza__3214EC072CC718B0" PRIMARY KEY ("Id");
ALTER TABLE "Organizaciones_BaileysSession" ADD CONSTRAINT "PK__Organiza__3214EC07E203E0BB" PRIMARY KEY ("Id");
ALTER TABLE "Pagos" ADD CONSTRAINT "PK__Pagos__3214EC07D161A3FF" PRIMARY KEY ("Id");
ALTER TABLE "PagosSuscripcion" ADD CONSTRAINT "PK__PagosSus__3214EC0705792436" PRIMARY KEY ("Id");
ALTER TABLE "Paises" ADD CONSTRAINT "PK__Paises__3214EC279DB2E97B" PRIMARY KEY ("ID");
ALTER TABLE "prioridades_cobranza" ADD CONSTRAINT "PK__priorida__3213E83FA59491E1" PRIMARY KEY ("id");
ALTER TABLE "Recordatorios" ADD CONSTRAINT "PK__Recordat__3214EC0766DDD961" PRIMARY KEY ("Id");
ALTER TABLE "RecordatoriosProgramados" ADD CONSTRAINT "PK__Recordat__3214EC07CE1BB57C" PRIMARY KEY ("Id");
ALTER TABLE "Regimen" ADD CONSTRAINT "PK_Regimen" PRIMARY KEY ("ID_Regimen");
ALTER TABLE "Roles" ADD CONSTRAINT "PK__Roles__3214EC07BBD5A877" PRIMARY KEY ("Id");
ALTER TABLE "Suscripciones" ADD CONSTRAINT "PK__Suscripc__3214EC076C6E7FBC" PRIMARY KEY ("Id");
ALTER TABLE "tickets_soporte" ADD CONSTRAINT "PK_tickets_soporte" PRIMARY KEY ("id");
ALTER TABLE "Usuario_Organizacion" ADD CONSTRAINT "PK__Usuario___3214EC07D75CF6A9" PRIMARY KEY ("Id");
ALTER TABLE "Usuarios" ADD CONSTRAINT "PK__Usuarios__3214EC07E1F76580" PRIMARY KEY ("Id");
ALTER TABLE "DatosFacturacionSuscripcion" ADD CONSTRAINT "UQ_DatosFacturacion_Org" UNIQUE ("OrganizacionId");
ALTER TABLE "estados_factura" ADD CONSTRAINT "UQ__estados___40F9A2060B6BB5FB" UNIQUE ("codigo");
ALTER TABLE "Facturas" ADD CONSTRAINT "UQ_facturas_numero_factura" UNIQUE ("numero_factura");
ALTER TABLE "prioridades_cobranza" ADD CONSTRAINT "UQ__priorida__40F9A206B07E5947" UNIQUE ("codigo");
ALTER TABLE "Usuarios" ADD CONSTRAINT "UQ__Usuarios__60695A191846C523" UNIQUE ("Correo");

ALTER TABLE "Agentes_Clientes" ADD CONSTRAINT "FK_AgenteCliente_Cliente" FOREIGN KEY ("ClienteId") REFERENCES "Clientes"("Id");
ALTER TABLE "Agentes_Clientes" ADD CONSTRAINT "FK_AgenteCliente_Usuario" FOREIGN KEY ("UsuarioId") REFERENCES "Usuarios"("Id");
ALTER TABLE "audit_log" ADD CONSTRAINT "FK__audit_log__organ__7FEAFD3E" FOREIGN KEY ("organizacion_id") REFERENCES "Organizaciones"("Id") ON DELETE CASCADE;
ALTER TABLE "audit_log" ADD CONSTRAINT "FK__audit_log__usuar__7E02B4CC" FOREIGN KEY ("usuario_id") REFERENCES "Usuarios"("Id");
ALTER TABLE "auditoria_intentos_registro" ADD CONSTRAINT "FK__auditoria__Usuar__7A3223E8" FOREIGN KEY ("UsuarioId") REFERENCES "Usuarios"("Id");
ALTER TABLE "Clientes" ADD CONSTRAINT "FK_Clientes_Estado" FOREIGN KEY ("EstadoId") REFERENCES "Estados"("ID");
ALTER TABLE "Clientes" ADD CONSTRAINT "FK_Clientes_Organizacion" FOREIGN KEY ("OrganizacionId") REFERENCES "Organizaciones"("Id");
ALTER TABLE "Clientes" ADD CONSTRAINT "FK_Clientes_Pais" FOREIGN KEY ("PaisId") REFERENCES "Paises"("ID");
ALTER TABLE "Clientes" ADD CONSTRAINT "FK_Clientes_Regimen" FOREIGN KEY ("RegimenFiscalId") REFERENCES "Regimen"("ID_Regimen");
ALTER TABLE "ComprobantesRecibidos" ADD CONSTRAINT "FK_ComprobantesRecibidos_Facturas" FOREIGN KEY ("FacturaId") REFERENCES "Facturas"("Id");
ALTER TABLE "ComprobantesRecibidos" ADD CONSTRAINT "FK_ComprobantesRecibidos_Organizaciones" FOREIGN KEY ("OrganizacionId") REFERENCES "Organizaciones"("Id");
ALTER TABLE "ConceptosFactura" ADD CONSTRAINT "FK_ConceptosFactura_Factura" FOREIGN KEY ("FacturaId") REFERENCES "Facturas"("Id") ON DELETE CASCADE;
ALTER TABLE "configuracion_organizacion" ADD CONSTRAINT "fk_organizacion" FOREIGN KEY ("organizacion_id") REFERENCES "Organizaciones"("Id");
ALTER TABLE "configuracion_organizacion" ADD CONSTRAINT "fk_regimen" FOREIGN KEY ("regimen_fiscal") REFERENCES "Regimen"("ID_Regimen");
ALTER TABLE "ConfiguracionCobranza" ADD CONSTRAINT "FK_ConfiguracionCobranza_Organizacion" FOREIGN KEY ("OrganizacionId") REFERENCES "Organizaciones"("Id");
ALTER TABLE "DatosFacturacionSuscripcion" ADD CONSTRAINT "FK_DatosFacturacion_Organizacion" FOREIGN KEY ("OrganizacionId") REFERENCES "Organizaciones"("Id");
ALTER TABLE "DatosFacturacionSuscripcion" ADD CONSTRAINT "FK_DatosFacturacion_Regimen" FOREIGN KEY ("RegimenFiscalId") REFERENCES "Regimen"("ID_Regimen");
ALTER TABLE "Estados" ADD CONSTRAINT "FK__Estados__PaisID__0D7A0286" FOREIGN KEY ("PaisID") REFERENCES "Paises"("ID");
ALTER TABLE "Facturas" ADD CONSTRAINT "FK_Facturas_Clientes" FOREIGN KEY ("ClienteId") REFERENCES "Clientes"("Id");
ALTER TABLE "Facturas" ADD CONSTRAINT "FK_facturas_estado_factura" FOREIGN KEY ("estado_factura_id") REFERENCES "estados_factura"("id");
ALTER TABLE "Facturas" ADD CONSTRAINT "FK_Facturas_FacturaOrigen" FOREIGN KEY ("FacturaOrigenId") REFERENCES "Facturas"("Id");
ALTER TABLE "Facturas" ADD CONSTRAINT "FK_facturas_prioridad_cobranza" FOREIGN KEY ("prioridad_cobranza_id") REFERENCES "prioridades_cobranza"("id");
ALTER TABLE "Facturas" ADD CONSTRAINT "FK_Facturas_UsuarioCreador" FOREIGN KEY ("UsuarioCreadorId") REFERENCES "Usuarios"("Id");
ALTER TABLE "GestionesCobranza" ADD CONSTRAINT "FK_GestionesCobranza_Factura" FOREIGN KEY ("FacturaId") REFERENCES "Facturas"("Id");
ALTER TABLE "GestionesCobranza" ADD CONSTRAINT "FK_GestionesCobranza_Usuario" FOREIGN KEY ("UsuarioId") REFERENCES "Usuarios"("Id");
ALTER TABLE "ImpuestosConcepto" ADD CONSTRAINT "FK_ImpuestosConcepto_Concepto" FOREIGN KEY ("ConceptoId") REFERENCES "ConceptosFactura"("Id") ON DELETE CASCADE;
ALTER TABLE "Pagos" ADD CONSTRAINT "FK_Pagos_Facturas" FOREIGN KEY ("FacturaId") REFERENCES "Facturas"("Id");
ALTER TABLE "Pagos" ADD CONSTRAINT "FK_Pagos_Usuarios" FOREIGN KEY ("UsuarioId") REFERENCES "Usuarios"("Id");
ALTER TABLE "PagosSuscripcion" ADD CONSTRAINT "FK_PagosSuscripcion_Suscripcion" FOREIGN KEY ("SuscripcionId") REFERENCES "Suscripciones"("Id");
ALTER TABLE "Recordatorios" ADD CONSTRAINT "FK_Recordatorios_Facturas" FOREIGN KEY ("FacturaId") REFERENCES "Facturas"("Id") ON DELETE CASCADE;
ALTER TABLE "Recordatorios" ADD CONSTRAINT "FK_Recordatorios_Usuario" FOREIGN KEY ("CreadoPor") REFERENCES "Usuarios"("Id");
ALTER TABLE "RecordatoriosProgramados" ADD CONSTRAINT "FK_RecordatoriosProgramados_Cliente" FOREIGN KEY ("ClienteId") REFERENCES "Clientes"("Id");
ALTER TABLE "RecordatoriosProgramados" ADD CONSTRAINT "FK_RecordatoriosProgramados_Factura" FOREIGN KEY ("FacturaId") REFERENCES "Facturas"("Id");
ALTER TABLE "Suscripciones" ADD CONSTRAINT "FK_Suscripciones_Organizacion" FOREIGN KEY ("OrganizacionId") REFERENCES "Organizaciones"("Id");
ALTER TABLE "tickets_soporte" ADD CONSTRAINT "FK_tickets_soporte_usuario" FOREIGN KEY ("usuarioid") REFERENCES "Usuarios"("Id");
ALTER TABLE "tickets_soporte" ADD CONSTRAINT "FK_tickets_soporte_organizacion" FOREIGN KEY ("organizacionid") REFERENCES "Organizaciones"("Id");
ALTER TABLE "Usuario_Organizacion" ADD CONSTRAINT "FK_UsuarioOrganizacion_Organizacion" FOREIGN KEY ("OrganizacionId") REFERENCES "Organizaciones"("Id");
ALTER TABLE "Usuario_Organizacion" ADD CONSTRAINT "FK_UsuarioOrganizacion_Rol" FOREIGN KEY ("RolId") REFERENCES "Roles"("Id");
ALTER TABLE "Usuario_Organizacion" ADD CONSTRAINT "FK_UsuarioOrganizacion_Usuario" FOREIGN KEY ("UsuarioId") REFERENCES "Usuarios"("Id");

CREATE INDEX "idx_comprobantesrecibidos_0" ON "ComprobantesRecibidos" ("Estado");
CREATE INDEX "idx_comprobantesrecibidos_1" ON "ComprobantesRecibidos" ("FacturaId");
CREATE INDEX "idx_comprobantesrecibidos_2" ON "ComprobantesRecibidos" ("FechaRecepcion");
CREATE INDEX "idx_comprobantesrecibidos_3" ON "ComprobantesRecibidos" ("OrganizacionId");
CREATE INDEX "idx_configuracion_organizacion_4" ON "configuracion_organizacion" ("csd_cer_hash");
CREATE INDEX "idx_configuracion_organizacion_5" ON "configuracion_organizacion" ("csd_key_hash");
CREATE INDEX "idx_facturas_6" ON "Facturas" ("FacturaOrigenId") WHERE ("FacturaOrigenId" IS NOT NULL);
CREATE INDEX "idx_pagos_7" ON "Pagos" ("Id") WHERE ("ComprobanteBase64" IS NOT NULL);
CREATE UNIQUE INDEX "idx_pagos_8" ON "Pagos" ("TokenComprobante") WHERE ("TokenComprobante" IS NOT NULL);
CREATE INDEX "idx_pagossuscripcion_9" ON "PagosSuscripcion" ("SuscripcionId");
CREATE UNIQUE INDEX "idx_suscripciones_10" ON "Suscripciones" ("OrganizacionId");
CREATE INDEX "idx_suscripciones_11" ON "Suscripciones" ("StripeCustomerId");
CREATE INDEX "idx_suscripciones_12" ON "Suscripciones" ("StripeSubscriptionId");
CREATE UNIQUE INDEX "idx_usuarios_13" ON "Usuarios" ("google_id") WHERE ("google_id" IS NOT NULL);
CREATE INDEX "idx_tickets_soporte_usuario" ON "tickets_soporte" ("usuarioid");
CREATE INDEX "idx_tickets_soporte_org" ON "tickets_soporte" ("organizacionid");
