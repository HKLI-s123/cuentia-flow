-- ========== SCRIPT DE MIGRACIÓN: AGREGAR SEGURIDAD Y PLANES ==========
-- Ejecutar este script en la base de datos para agregar soporte de planes y validaciones de CSD único

-- 1. Verificar si la tabla usuarios existe
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'usuarios')
BEGIN
    PRINT 'ERROR: Tabla usuarios no encontrada en la base de datos';
    RAISERROR('Tabla usuarios no existe', 16, 1);
END
ELSE
    PRINT 'Tabla usuarios encontrada ✓';

-- 2. Agregar columna plan_id a la tabla usuarios (si no existe)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'plan_id')
BEGIN
    BEGIN TRY
        -- Agregar la columna como NULLABLE primero con DEFAULT para nuevas filas
        ALTER TABLE usuarios
        ADD plan_id NVARCHAR(50) DEFAULT 'FREE' NULL;
        PRINT 'Columna plan_id agregada a tabla usuarios ✓';
        
        -- Actualizar todas las filas existentes a 'FREE'
        UPDATE usuarios
        SET plan_id = 'FREE'
        WHERE plan_id IS NULL;
        PRINT 'Filas existentes actualizadas al plan FREE ✓';
    END TRY
    BEGIN CATCH
        PRINT 'ERROR al agregar plan_id: ' + ERROR_MESSAGE();
        RAISERROR('No se pudo agregar columna plan_id', 16, 1);
    END CATCH
END
ELSE
    PRINT 'Columna plan_id ya existe en tabla usuarios ✓';

-- 3. Verificar si la tabla configuracion_organizacion existe
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'configuracion_organizacion')
BEGIN
    PRINT 'ERROR: Tabla configuracion_organizacion no encontrada en la base de datos';
    RAISERROR('Tabla configuracion_organizacion no existe', 16, 1);
END
ELSE
    PRINT 'Tabla configuracion_organizacion encontrada ✓';

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

-- 5. Crear índices para búsquedas rápidas de duplicados
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_csd_cer_hash')
BEGIN
    BEGIN TRY
        CREATE INDEX idx_csd_cer_hash ON configuracion_organizacion(csd_cer_hash);
        PRINT 'Índice idx_csd_cer_hash creado ✓';
    END TRY
    BEGIN CATCH
        PRINT 'Índice idx_csd_cer_hash ya existe o error: ' + ERROR_MESSAGE();
    END CATCH
END
ELSE
    PRINT 'Índice idx_csd_cer_hash ya existe ✓';

IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_csd_key_hash')
BEGIN
    BEGIN TRY
        CREATE INDEX idx_csd_key_hash ON configuracion_organizacion(csd_key_hash);
        PRINT 'Índice idx_csd_key_hash creado ✓';
    END TRY
    BEGIN CATCH
        PRINT 'Índice idx_csd_key_hash ya existe o error: ' + ERROR_MESSAGE();
    END CATCH
END
ELSE
    PRINT 'Índice idx_csd_key_hash ya existe ✓';

-- 6. Crear índice único para RFC (si no existe)
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_rfc_unico')
BEGIN
    BEGIN TRY
        CREATE UNIQUE INDEX idx_rfc_unico ON organizaciones(RFC);
        PRINT 'Índice único idx_rfc_unico creado en RFC ✓';
    END TRY
    BEGIN CATCH
        PRINT 'Índice RFC puede haber duplicados o ya existe: ' + ERROR_MESSAGE();
    END CATCH
END
ELSE
    PRINT 'Índice idx_rfc_unico ya existe ✓';

-- 7. Crear tabla de auditoría (opcional, para seguridad)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'auditoria_intentos_registro')
BEGIN
    BEGIN TRY
        CREATE TABLE auditoria_intentos_registro (
            Id INT PRIMARY KEY IDENTITY(1,1),
            UsuarioId INT,
            RFC NVARCHAR(13),
            Tipo NVARCHAR(50), -- 'ÉXITO', 'RFC_DUPLICADO', 'LÍMITE_EXCEDIDO', 'CSD_DUPLICADO', etc.
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

-- 8. Ver estado actual de planes de usuarios
PRINT '';
PRINT '========== PLANES DE USUARIOS ACTUALES ==========';
BEGIN TRY
    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'plan_id')
    BEGIN
        SELECT ISNULL(plan_id, 'SIN ASIGNAR') as [Plan], COUNT(*) as [Cantidad de usuarios]
        FROM usuarios
        GROUP BY plan_id;
    END
    ELSE
    BEGIN
        PRINT 'Columna plan_id aún no existe para mostrar estado';
    END
END TRY
BEGIN CATCH
    PRINT 'Error al mostrar estado de planes: ' + ERROR_MESSAGE();
END CATCH

-- 9. Verificar RFC duplicados actuales (si los hay)
PRINT '';
PRINT '========== VALIDACIÓN: RFC DUPLICADOS ==========';
BEGIN TRY
    DECLARE @DuplicateRFCCount INT;
    SELECT @DuplicateRFCCount = COUNT(*)
    FROM (
        SELECT RFC, COUNT(*) as cnt
        FROM organizaciones
        GROUP BY RFC
        HAVING COUNT(*) > 1
    ) as dupes;

    IF @DuplicateRFCCount > 0
    BEGIN
        SELECT RFC, COUNT(*) as [Repeticiones]
        FROM organizaciones
        GROUP BY RFC
        HAVING COUNT(*) > 1;
        PRINT 'ADVERTENCIA: Se encontraron RFC duplicados. Revisar manualmente.';
    END
    ELSE
    BEGIN
        PRINT 'No hay RFC duplicados ✓';
    END
END TRY
BEGIN CATCH
    PRINT 'Error en validación de RFC: ' + ERROR_MESSAGE();
END CATCH

-- 10. Actualizar usuarios sin plan a plan FREE (si la columna existe)
BEGIN TRY
    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'plan_id')
    BEGIN
        UPDATE usuarios
        SET plan_id = 'FREE'
        WHERE plan_id IS NULL OR plan_id = '';
        PRINT '';
        PRINT 'Usuarios sin plan asignados al plan FREE ✓';
    END
    ELSE
    BEGIN
        PRINT 'No se pudo asignar planes (columna plan_id no existe)';
    END
END TRY
BEGIN CATCH
    PRINT 'No se pudo actualizar planes: ' + ERROR_MESSAGE();
END CATCH

-- ========== FIN DEL SCRIPT DE MIGRACIÓN ==========
PRINT '';
PRINT '✓ Migración completada correctamente';
