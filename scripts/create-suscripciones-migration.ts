import sql from 'mssql';
import 'dotenv/config';

const pool = await sql.connect({
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  server: process.env.DB_SERVER!,
  database: process.env.DB_NAME!,
  options: { encrypt: true, trustServerCertificate: false }
});

console.log('Connected to database');

// 1. Tabla Suscripciones
try {
  await pool.query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Suscripciones')
    BEGIN
      CREATE TABLE Suscripciones (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OrganizacionId INT NOT NULL,
        StripeCustomerId NVARCHAR(255) NULL,
        StripeSubscriptionId NVARCHAR(255) NULL,
        StripePriceId NVARCHAR(255) NULL,
        PlanSeleccionado NVARCHAR(50) NOT NULL DEFAULT 'free',
        Estado NVARCHAR(50) NOT NULL DEFAULT 'active',
        FechaInicio DATETIME NOT NULL DEFAULT GETDATE(),
        FechaFinPeriodo DATETIME NULL,
        FechaCancelacion DATETIME NULL,
        TrialEnd DATETIME NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Suscripciones_Organizacion FOREIGN KEY (OrganizacionId) 
          REFERENCES Organizaciones(Id)
      )
    END
  `);
  console.log('OK: Tabla Suscripciones');
} catch (e: any) { console.error('ERR Suscripciones:', e.message); }

// 2. Índices de Suscripciones
try {
  await pool.query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Suscripciones_OrgId')
      CREATE UNIQUE INDEX IX_Suscripciones_OrgId ON Suscripciones(OrganizacionId)
  `);
  await pool.query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Suscripciones_StripeCustomer')
      CREATE INDEX IX_Suscripciones_StripeCustomer ON Suscripciones(StripeCustomerId)
  `);
  await pool.query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Suscripciones_StripeSub')
      CREATE INDEX IX_Suscripciones_StripeSub ON Suscripciones(StripeSubscriptionId)
  `);
  console.log('OK: Índices Suscripciones');
} catch (e: any) { console.error('ERR índices:', e.message); }

// 3. Tabla PagosSuscripcion
try {
  await pool.query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PagosSuscripcion')
    BEGIN
      CREATE TABLE PagosSuscripcion (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SuscripcionId INT NOT NULL,
        StripeInvoiceId NVARCHAR(255) NULL,
        StripePaymentIntentId NVARCHAR(255) NULL,
        Monto DECIMAL(18,2) NOT NULL,
        Moneda NVARCHAR(10) NOT NULL DEFAULT 'mxn',
        Estado NVARCHAR(50) NOT NULL,
        FechaPago DATETIME NOT NULL DEFAULT GETDATE(),
        UrlRecibo NVARCHAR(500) NULL,
        CONSTRAINT FK_PagosSuscripcion_Suscripcion FOREIGN KEY (SuscripcionId) 
          REFERENCES Suscripciones(Id)
      )
    END
  `);
  console.log('OK: Tabla PagosSuscripcion');
} catch (e: any) { console.error('ERR PagosSuscripcion:', e.message); }

// 4. Índice PagosSuscripcion
try {
  await pool.query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PagosSuscripcion_SubId')
      CREATE INDEX IX_PagosSuscripcion_SubId ON PagosSuscripcion(SuscripcionId)
  `);
  console.log('OK: Índice PagosSuscripcion');
} catch (e: any) { console.error('ERR índice pagos:', e.message); }

// 5. Insertar suscripción free para organizaciones existentes que no tengan una
try {
  const result = await pool.query(`
    INSERT INTO Suscripciones (OrganizacionId, PlanSeleccionado, Estado)
    SELECT o.Id, 'free', 'active'
    FROM Organizaciones o
    WHERE NOT EXISTS (SELECT 1 FROM Suscripciones s WHERE s.OrganizacionId = o.Id)
  `);
  console.log(`OK: ${result.rowsAffected[0]} suscripciones free creadas para orgs existentes`);
} catch (e: any) { console.error('ERR seed:', e.message); }

await pool.close();
console.log('Migration complete!');
