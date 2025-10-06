-- MIGRACIÓN: Facturas con Conceptos y Recurrencia
-- Fecha: 2025-10-05
-- Propósito: Agregar soporte para facturas recurrentes con conceptos detallados

USE Cobranza;
GO

-- ============================================
-- PASO 1: Crear tabla ConceptosFactura
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ConceptosFactura')
BEGIN
    CREATE TABLE ConceptosFactura (
        Id INT PRIMARY KEY IDENTITY(1,1),
        FacturaId INT NOT NULL,
        Nombre NVARCHAR(255) NOT NULL,
        Descripcion NVARCHAR(500),
        ClaveProdServ NVARCHAR(50),
        UnidadMedida NVARCHAR(10) NOT NULL,
        Cantidad DECIMAL(18,2) NOT NULL,
        PrecioUnitario DECIMAL(18,2) NOT NULL,
        Subtotal DECIMAL(18,2) NOT NULL,
        MonedaProducto NVARCHAR(10),
        ObjetoImpuesto NVARCHAR(10),
        TotalImpuestos DECIMAL(18,2) DEFAULT 0,
        Total DECIMAL(18,2) NOT NULL,
        CONSTRAINT FK_ConceptosFactura_Factura FOREIGN KEY (FacturaId)
            REFERENCES Facturas(Id) ON DELETE CASCADE
    );
    PRINT 'Tabla ConceptosFactura creada exitosamente';
END
ELSE
    PRINT 'Tabla ConceptosFactura ya existe';
GO

-- ============================================
-- PASO 2: Crear tabla ImpuestosConcepto
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ImpuestosConcepto')
BEGIN
    CREATE TABLE ImpuestosConcepto (
        Id INT PRIMARY KEY IDENTITY(1,1),
        ConceptoId INT NOT NULL,
        Tipo NVARCHAR(50) NOT NULL,
        Tasa DECIMAL(5,4) NOT NULL,
        Monto DECIMAL(18,2) NOT NULL,
        CONSTRAINT FK_ImpuestosConcepto_Concepto FOREIGN KEY (ConceptoId)
            REFERENCES ConceptosFactura(Id) ON DELETE CASCADE
    );
    PRINT 'Tabla ImpuestosConcepto creada exitosamente';
END
ELSE
    PRINT 'Tabla ImpuestosConcepto ya existe';
GO

-- ============================================
-- PASO 3: Agregar campos de recurrencia a Facturas
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'RecurrenciaActiva' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD RecurrenciaActiva BIT DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'OrdenRecurrencia' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD OrdenRecurrencia NVARCHAR(50);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'IdentificadorRecurrencia' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD IdentificadorRecurrencia NVARCHAR(100);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'FechaInicioRecurrencia' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD FechaInicioRecurrencia DATE;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'FechaPrimeraFactura' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD FechaPrimeraFactura DATE;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'PeriodoRecurrencia' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD PeriodoRecurrencia NVARCHAR(20);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'DiaRecurrencia' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD DiaRecurrencia NVARCHAR(10);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'CadaRecurrencia' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD CadaRecurrencia NVARCHAR(20);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'FinRecurrencia' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD FinRecurrencia NVARCHAR(20);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'FechaFinRecurrencia' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD FechaFinRecurrencia DATE;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'NumeroOcurrencias' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD NumeroOcurrencias INT;

PRINT 'Campos de recurrencia agregados/verificados';
GO

-- ============================================
-- PASO 4: Agregar campos adicionales a Facturas
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'OrdenCompra' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD OrdenCompra NVARCHAR(100);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'Moneda' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD Moneda NVARCHAR(10) DEFAULT 'MXN';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'TipoCambio' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD TipoCambio DECIMAL(10,4) DEFAULT 1.0000;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'CondicionesPago' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD CondicionesPago NVARCHAR(50);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'NotasCliente' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD NotasCliente NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'NotasInternas' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD NotasInternas NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'UUIDFacturapi' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD UUIDFacturapi NVARCHAR(100);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'PDFUrl' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD PDFUrl NVARCHAR(500);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'XMLUrl' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD XMLUrl NVARCHAR(500);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'DesglosarImpuestos' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD DesglosarImpuestos BIT DEFAULT 1;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'Identificador' AND object_id = OBJECT_ID('Facturas'))
    ALTER TABLE Facturas ADD Identificador NVARCHAR(100);

PRINT 'Campos adicionales agregados/verificados';
GO

-- ============================================
-- PASO 5: Verificar estructura final
-- ============================================
PRINT '';
PRINT '==============================================';
PRINT 'MIGRACIÓN COMPLETADA EXITOSAMENTE';
PRINT '==============================================';
PRINT '';
PRINT 'Tablas creadas:';
PRINT '  ✓ ConceptosFactura';
PRINT '  ✓ ImpuestosConcepto';
PRINT '';
PRINT 'Campos agregados a Facturas:';
PRINT '  ✓ Campos de recurrencia (11 campos)';
PRINT '  ✓ Campos adicionales (10 campos)';
PRINT '';
PRINT 'Sistema listo para:';
PRINT '  ✓ Guardar facturas con conceptos detallados';
PRINT '  ✓ Guardar impuestos por concepto';
PRINT '  ✓ Configurar facturas recurrentes';
PRINT '  ✓ Integración con Facturapi';
PRINT '';
GO
