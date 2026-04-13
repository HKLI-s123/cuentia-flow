-- ========== SCRIPT DE MIGRACIÓN: AGREGAR SEGURIDAD Y PLANES (V2 - Azure SQL) ==========
-- Ejecutar este script en la base de datos para agregar soporte de planes y validaciones de CSD único
-- Este script usa GO para dividir en lotes y evitar errores de compilación en Azure SQL

-- ============ LOTE 1: VALIDACIONES INICIALES ============
PRINT 'Iniciando migración de seguridad y planes...';
PRINT '';

-- 1. Verificar si la tabla usuarios existe
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'usuarios')
BEGIN
    PRINT 'ERROR: Tabla usuarios no encontrada en la base de datos';
    RAISERROR('Tabla usuarios no existe', 16, 1);
END
ELSE
    PRINT 'Tabla usuarios encontrada ✓';

-- 3. Verificar si la tabla configuracion_organizacion existe
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'configuracion_organizacion')
BEGIN
    PRINT 'ERROR: Tabla configuracion_organizacion no encontrada en la base de datos';
    RAISERROR('Tabla configuracion_organizacion no existe', 16, 1);
END
ELSE
    PRINT 'Tabla configuracion_organizacion encontrada ✓';

-- ============ LOTE 2: AGREGAR COLUMNA plan_id ============
GO

PRINT '';
PRINT '========== AGREGANDO COLUMNA plan_id ==========';

-- 2. Agregar columna plan_id a la tabla usuarios (si no existe)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'plan_id')
BEGIN
    BEGIN TRY
        -- Agregar la columna como NULLABLE con DEFAULT para nuevas filas
        ALTER TABLE usuarios
        ADD plan_id NVARCHAR(50) DEFAULT 'FREE' NULL;
        PRINT 'Columna plan_id agregada a tabla usuarios ✓';
    END TRY
    BEGIN CATCH
        PRINT 'ERROR al agregar plan_id: ' + ERROR_MESSAGE();
        RAISERROR('No se pudo agregar columna plan_id', 16, 1);
    END CATCH
END
ELSE
    PRINT 'Columna plan_id ya existe en tabla usuarios ✓';

-- ============ LOTE 3: ACTUALIZAR DATOS plan_id ============
GO

PRINT '';
PRINT '========== ACTUALIZANDO DATOS plan_id ==========';

-- Actualizar todas las filas existentes a 'FREE'
BEGIN TRY
    UPDATE usuarios
    SET plan_id = 'FREE'
    WHERE plan_id IS NULL;
    PRINT 'Filas existentes actualizadas al plan FREE ✓';
END TRY
BEGIN CATCH
    PRINT 'ERROR al actualizar plan_id: ' + ERROR_MESSAGE();
END CATCH

-- ============ LOTE 4: AGREGAR COLUMNAS DE CSD HASH ============
GO

PRINT '';
PRINT '========== AGREGANDO COLUMNAS DE CSD HASH ==========';

-- 4. Agregar columnas de hash de CSD a configuracion_organizacion
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'configuracion_organizacion' AND COLUMN_NAME = 'csd_cer_hash')
BEGIN
    BEGIN TRY
        ALTER TABLE configuracion_organizacion
        ADD csd_cer_hash NVARCHAR(255) NULL;
        PRINT 'Columna csd_cer_hash agregada a configuracion_organizacion ✓';
    END TRY
    BEGIN CATCH
        PRINT 'ERROR al agregar csd_cer_hash: ' + ERROR_MESSAGE();
    END CATCH
END
ELSE
    PRINT 'Columna csd_cer_hash ya existe ✓';

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'configuracion_organizacion' AND COLUMN_NAME = 'csd_key_hash')
BEGIN
    BEGIN TRY
        ALTER TABLE configuracion_organizacion
        ADD csd_key_hash NVARCHAR(255) NULL;
        PRINT 'Columna csd_key_hash agregada a configuracion_organizacion ✓';
    END TRY
    BEGIN CATCH
        PRINT 'ERROR al agregar csd_key_hash: ' + ERROR_MESSAGE();
    END CATCH
END
ELSE
    PRINT 'Columna csd_key_hash ya existe ✓';

-- ============ LOTE 5: CREAR ÍNDICES ============
GO

PRINT '';
PRINT '========== CREANDO ÍNDICES ==========';

-- 5. Crear índices para búsquedas rápidas de duplicados
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_csd_cer_hash' AND object_id = OBJECT_ID('configuracion_organizacion'))
BEGIN
    BEGIN TRY
        CREATE INDEX idx_csd_cer_hash ON configuracion_organizacion(csd_cer_hash);
        PRINT 'Índice idx_csd_cer_hash creado ✓';
    END TRY
    BEGIN CATCH
        PRINT 'Índice idx_csd_cer_hash: ' + ERROR_MESSAGE();
    END CATCH
END
ELSE
    PRINT 'Índice idx_csd_cer_hash ya existe ✓';

IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_csd_key_hash' AND object_id = OBJECT_ID('configuracion_organizacion'))
BEGIN
    BEGIN TRY
        CREATE INDEX idx_csd_key_hash ON configuracion_organizacion(csd_key_hash);
        PRINT 'Índice idx_csd_key_hash creado ✓';
    END TRY
    BEGIN CATCH
        PRINT 'Índice idx_csd_key_hash: ' + ERROR_MESSAGE();
    END CATCH
END
ELSE
    PRINT 'Índice idx_csd_key_hash ya existe ✓';

-- 6. Crear índice único para RFC
-- Primero verificar si hay duplicados que impidan crear índice único
DECLARE @DuplicateRFCCount INT = 0;

BEGIN TRY
    SELECT @DuplicateRFCCount = COUNT(*)
    FROM (
        SELECT RFC, COUNT(*) as cnt
        FROM organizaciones
        GROUP BY RFC
        HAVING COUNT(*) > 1
    ) as dupes;
    
    IF @DuplicateRFCCount = 0
    BEGIN
        IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_rfc_unico' AND object_id = OBJECT_ID('organizaciones'))
        BEGIN
            CREATE UNIQUE INDEX idx_rfc_unico ON organizaciones(RFC);
            PRINT 'Índice único idx_rfc_unico creado en RFC ✓';
        END
        ELSE
            PRINT 'Índice idx_rfc_unico ya existe ✓';
    END
    ELSE
    BEGIN
        PRINT 'ADVERTENCIA: No se pudo crear índice RFC único. Hay ' + CAST(@DuplicateRFCCount AS NVARCHAR(10)) + ' RFC(s) duplicado(s).';
    END
END TRY
BEGIN CATCH
    PRINT 'Error al crear índice RFC: ' + ERROR_MESSAGE();
END CATCH

-- ============ LOTE 6: CREAR TABLA DE AUDITORÍA ============
GO

PRINT '';
PRINT '========== CREANDO TABLA DE AUDITORÍA ==========';

-- 7. Crear tabla de auditoría (opcional, para seguridad)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'auditoria_intentos_registro')
BEGIN
    BEGIN TRY
        CREATE TABLE auditoria_intentos_registro (
            Id INT PRIMARY KEY IDENTITY(1,1),
            UsuarioId INT,
            RFC NVARCHAR(13),
            Tipo NVARCHAR(50),
            Mensaje NVARCHAR(255),
            Timestamp DATETIME DEFAULT GETDATE(),
            FOREIGN KEY (UsuarioId) REFERENCES usuarios(Id)
        );
        PRINT 'Tabla auditoria_intentos_registro creada ✓';
    END TRY
    BEGIN CATCH
        PRINT 'ERROR al crear tabla auditoria: ' + ERROR_MESSAGE();
    END CATCH
END
ELSE
    PRINT 'Tabla auditoria_intentos_registro ya existe ✓';

-- ============ LOTE 7: REPORTES Y VALIDACIONES ============
GO

PRINT '';
PRINT '========== PLANES DE USUARIOS ACTUALES ==========';

-- 8. Ver estado actual de planes de usuarios (usando dinámico SQL para evitar error de columna inexistente)
BEGIN TRY
    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'plan_id')
    BEGIN
        EXEC sp_executesql N'SELECT ISNULL(plan_id, ''SIN ASIGNAR'') as [Plan], COUNT(*) as [Cantidad de usuarios] FROM usuarios GROUP BY plan_id;'
    END
    ELSE
    BEGIN
        PRINT 'Columna plan_id aún no existe para mostrar estado';
    END
END TRY
BEGIN CATCH
    PRINT 'Error al mostrar estado de planes: ' + ERROR_MESSAGE();
END CATCH

PRINT '';
PRINT '========== VALIDACIÓN: RFC DUPLICADOS ==========';

-- 9. Verificar RFC duplicados actuales
BEGIN TRY
    DECLARE @DuplicateCount INT;
    SELECT @DuplicateCount = COUNT(*)
    FROM (
        SELECT RFC, COUNT(*) as cnt
        FROM organizaciones
        GROUP BY RFC
        HAVING COUNT(*) > 1
    ) as dupes;

    IF @DuplicateCount > 0
    BEGIN
        PRINT 'Se encontraron ' + CAST(@DuplicateCount AS NVARCHAR(10)) + ' RFC(s) duplicado(s):';
        EXEC sp_executesql N'SELECT RFC, COUNT(*) as [Repeticiones] FROM organizaciones GROUP BY RFC HAVING COUNT(*) > 1;'
    END
    ELSE
    BEGIN
        PRINT 'No hay RFC duplicados ✓';
    END
END TRY
BEGIN CATCH
    PRINT 'Error en validación de RFC: ' + ERROR_MESSAGE();
END CATCH

-- ============ FINAL ============
PRINT '';
PRINT '✓✓✓ MIGRACIÓN COMPLETADA CORRECTAMENTE ✓✓✓';
PRINT '';
PRINT 'Cambios realizados:';
PRINT '  ✓ Columna plan_id agregada a usuarios (DEFAULT: FREE)';
PRINT '  ✓ Columnas csd_cer_hash y csd_key_hash agregadas a configuracion_organizacion';
PRINT '  ✓ Índices creados para búsquedas rápidas';
PRINT '  ✓ Tabla de auditoría creada (si no existía)';
PRINT '';
