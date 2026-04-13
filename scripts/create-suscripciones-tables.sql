-- =============================================
-- Tabla de Suscripciones (Stripe)
-- =============================================

-- Tabla principal de suscripciones
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Suscripciones')
BEGIN
  CREATE TABLE Suscripciones (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    OrganizacionId INT NOT NULL,
    StripeCustomerId NVARCHAR(255) NULL,        -- cus_xxx
    StripeSubscriptionId NVARCHAR(255) NULL,     -- sub_xxx
    StripePriceId NVARCHAR(255) NULL,            -- price_xxx
    PlanSeleccionado NVARCHAR(50) NOT NULL DEFAULT 'free',   -- free, basico, pro, enterprise
    Estado NVARCHAR(50) NOT NULL DEFAULT 'active', -- active, past_due, canceled, trialing, unpaid
    FechaInicio DATETIME NOT NULL DEFAULT GETDATE(),
    FechaFinPeriodo DATETIME NULL,               -- Fin del periodo actual de facturación
    FechaCancelacion DATETIME NULL,              -- Cuando se canceló (puede seguir activa hasta fin de periodo)
    TrialEnd DATETIME NULL,                      -- Fin del trial si aplica
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Suscripciones_Organizacion FOREIGN KEY (OrganizacionId) 
      REFERENCES Organizaciones(Id)
  );
  
  -- Índices
  CREATE UNIQUE INDEX IX_Suscripciones_OrgId ON Suscripciones(OrganizacionId);
  CREATE INDEX IX_Suscripciones_StripeCustomer ON Suscripciones(StripeCustomerId);
  CREATE INDEX IX_Suscripciones_StripeSub ON Suscripciones(StripeSubscriptionId);
  
  PRINT 'Tabla Suscripciones creada exitosamente';
END
ELSE
BEGIN
  PRINT 'Tabla Suscripciones ya existe';
END
GO

-- Tabla de historial de pagos
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PagosSuscripcion')
BEGIN
  CREATE TABLE PagosSuscripcion (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SuscripcionId INT NOT NULL,
    StripeInvoiceId NVARCHAR(255) NULL,          -- in_xxx
    StripePaymentIntentId NVARCHAR(255) NULL,     -- pi_xxx
    Monto DECIMAL(18,2) NOT NULL,
    Moneda NVARCHAR(10) NOT NULL DEFAULT 'mxn',
    Estado NVARCHAR(50) NOT NULL,                 -- paid, failed, refunded
    FechaPago DATETIME NOT NULL DEFAULT GETDATE(),
    UrlRecibo NVARCHAR(500) NULL,                 -- URL del recibo de Stripe
    CONSTRAINT FK_PagosSuscripcion_Suscripcion FOREIGN KEY (SuscripcionId) 
      REFERENCES Suscripciones(Id)
  );
  
  CREATE INDEX IX_PagosSuscripcion_SubId ON PagosSuscripcion(SuscripcionId);
  
  PRINT 'Tabla PagosSuscripcion creada exitosamente';
END
ELSE
BEGIN
  PRINT 'Tabla PagosSuscripcion ya existe';
END
GO
