import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';

export const GET: RequestHandler = async () => {
    try {
        const pool = await getConnection();
        const result: any = {
            timestamp: new Date().toISOString(),
            database: 'Cobranza',
            data: []
        };

        // 1. INFORMACIÓN GENERAL + TABLAS DISPONIBLES
        const resumenQuery = `
            SELECT
                'RESUMEN_BD' as Tipo,
                'Base de datos: Cobranza - Fecha: ' + CONVERT(VARCHAR, GETDATE(), 120) as Informacion,
                '' as Valor1, '' as Valor2, '' as Valor3, '' as Valor4, '' as Valor5
        `;
        const resumenResult = await pool.request().query(resumenQuery);
        result.data.push(...resumenResult.recordset);

        const tablasQuery = `
            SELECT
                'TABLA' as Tipo,
                TABLE_NAME as Informacion,
                '' as Valor1, '' as Valor2, '' as Valor3, '' as Valor4, '' as Valor5
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `;
        const tablasResult = await pool.request().query(tablasQuery);
        result.data.push(...tablasResult.recordset);

        // 2. ESTRUCTURA COMPLETA DE TODAS LAS TABLAS
        const estructuraQuery = `
            SELECT
                'ESTRUCTURA' as Tipo,
                t.TABLE_NAME + '.' + c.COLUMN_NAME as Informacion,
                CAST(c.ORDINAL_POSITION AS VARCHAR) as Valor1,
                c.DATA_TYPE as Valor2,
                c.IS_NULLABLE as Valor3,
                ISNULL(c.COLUMN_DEFAULT, '') as Valor4,
                '' as Valor5
            FROM INFORMATION_SCHEMA.TABLES t
            INNER JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME
            WHERE t.TABLE_TYPE = 'BASE TABLE'
            ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
        `;
        const estructuraResult = await pool.request().query(estructuraQuery);
        result.data.push(...estructuraResult.recordset);

        // 3. RELACIONES ENTRE TABLAS
        const relacionesQuery = `
            SELECT
                'RELACION' as Tipo,
                fk.TABLE_NAME + '.' + fk.COLUMN_NAME + ' -> ' + pk.TABLE_NAME + '.' + pk.COLUMN_NAME as Informacion,
                fk.TABLE_NAME as Valor1,
                fk.COLUMN_NAME as Valor2,
                pk.TABLE_NAME as Valor3,
                pk.COLUMN_NAME as Valor4,
                c.CONSTRAINT_NAME as Valor5
            FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS c
            INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE fk
                ON c.CONSTRAINT_NAME = fk.CONSTRAINT_NAME
            INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE pk
                ON c.UNIQUE_CONSTRAINT_NAME = pk.CONSTRAINT_NAME
            ORDER BY fk.TABLE_NAME
        `;
        const relacionesResult = await pool.request().query(relacionesQuery);
        result.data.push(...relacionesResult.recordset);

        // 4. CONTEO DE REGISTROS (usando lógica dinámica simplificada)
        const tablasList = tablasResult.recordset.map(row => row.Informacion);

        for (const tabla of tablasList) {
            try {
                const countQuery = `SELECT COUNT(*) as total FROM [${tabla}]`;
                const countResult = await pool.request().query(countQuery);
                const count = countResult.recordset[0].total;

                const estado = count === 0 ? 'Vacía' :
                              count <= 10 ? 'Pocos datos' :
                              count <= 100 ? 'Datos de prueba' : 'Datos abundantes';

                result.data.push({
                    Tipo: 'REGISTROS',
                    Informacion: tabla,
                    Valor1: count.toString(),
                    Valor2: estado,
                    Valor3: '',
                    Valor4: '',
                    Valor5: ''
                });
            } catch (error) {
                result.data.push({
                    Tipo: 'REGISTROS',
                    Informacion: tabla,
                    Valor1: 'Error',
                    Valor2: 'No se pudo contar',
                    Valor3: '',
                    Valor4: '',
                    Valor5: ''
                });
            }
        }

        // 5. DATOS DE MUESTRA - USUARIOS
        if (tablasList.includes('usuarios')) {
            try {
                const usuariosQuery = `
                    SELECT TOP 5
                        'MUESTRA_USUARIOS' as Tipo,
                        'Usuario ID: ' + CAST(id AS VARCHAR) as Informacion,
                        ISNULL(Nombre, '') as Valor1,
                        ISNULL(Correo, '') as Valor2,
                        CAST(ISNULL(Activo, 0) AS VARCHAR) as Valor3,
                        '' as Valor4, '' as Valor5
                    FROM usuarios
                    ORDER BY id
                `;
                const usuariosResult = await pool.request().query(usuariosQuery);
                result.data.push(...usuariosResult.recordset);
            } catch (error) {
                result.data.push({
                    Tipo: 'MUESTRA_USUARIOS',
                    Informacion: 'Error al obtener usuarios',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }
        }

        // 6. DATOS DE MUESTRA - CLIENTES
        if (tablasList.includes('clientes')) {
            try {
                const clientesQuery = `
                    SELECT TOP 5
                        'MUESTRA_CLIENTES' as Tipo,
                        'Cliente ID: ' + CAST(id AS VARCHAR) as Informacion,
                        ISNULL(NombreComercial, '') as Valor1,
                        ISNULL(rfc, '') as Valor2,
                        ISNULL(CorreoPrincipal, '') as Valor3,
                        CAST(ISNULL(Id, 0) AS VARCHAR) as Valor4,
                        '' as Valor5
                    FROM clientes
                    ORDER BY id
                `;
                const clientesResult = await pool.request().query(clientesQuery);
                result.data.push(...clientesResult.recordset);
            } catch (error) {
                result.data.push({
                    Tipo: 'MUESTRA_CLIENTES',
                    Informacion: 'Error al obtener clientes',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }
        }

        // 7. DATOS DE MUESTRA - FACTURAS
        if (tablasList.includes('facturas')) {
            try {
                const facturasQuery = `
                    SELECT TOP 5
                        'MUESTRA_FACTURAS' as Tipo,
                        'Factura ID: ' + CAST(Id AS VARCHAR) as Informacion,
                        CAST(ClienteId AS VARCHAR) as Valor1,
                        CAST(MontoTotal AS VARCHAR) as Valor2,
                        CONVERT(VARCHAR, FechaEmision, 120) as Valor3,
                        CONVERT(VARCHAR, FechaVencimiento, 120) as Valor4,
                        '' as Valor5
                    FROM facturas
                    ORDER BY Id
                `;
                const facturasResult = await pool.request().query(facturasQuery);
                result.data.push(...facturasResult.recordset);
            } catch (error) {
                result.data.push({
                    Tipo: 'MUESTRA_FACTURAS',
                    Informacion: 'Error al obtener facturas',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }
        }

        // 8. ANÁLISIS DE FACTURAS - RESUMEN GENERAL
        if (tablasList.includes('facturas')) {
            try {
                const resumenFacturasQuery = `
                    SELECT
                        'FACTURAS_RESUMEN' as Tipo,
                        'Estadísticas generales' as Informacion,
                        CAST(COUNT(*) AS VARCHAR) as Valor1,
                        CAST(SUM(MontoTotal) AS VARCHAR) as Valor2,
                        CAST(AVG(MontoTotal) AS VARCHAR) as Valor3,
                        CONVERT(VARCHAR, MIN(FechaEmision), 120) as Valor4,
                        CONVERT(VARCHAR, MAX(FechaEmision), 120) as Valor5
                    FROM facturas
                `;
                const resumenFacturasResult = await pool.request().query(resumenFacturasQuery);
                result.data.push(...resumenFacturasResult.recordset);
            } catch (error) {
                result.data.push({
                    Tipo: 'FACTURAS_RESUMEN',
                    Informacion: 'Error en resumen de facturas',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }

            // 9. AGING - CONTEO POR CATEGORÍAS
            try {
                const agingConteoQuery = `
                    SELECT
                        'AGING_CONTEO' as Tipo,
                        'Facturas por categoría de vencimiento' as Informacion,
                        CAST(SUM(CASE WHEN FechaVencimiento > GETDATE() THEN 1 ELSE 0 END) AS VARCHAR) as Valor1,
                        CAST(SUM(CASE WHEN FechaVencimiento <= GETDATE() AND FechaVencimiento > DATEADD(day, -30, GETDATE()) THEN 1 ELSE 0 END) AS VARCHAR) as Valor2,
                        CAST(SUM(CASE WHEN FechaVencimiento <= DATEADD(day, -30, GETDATE()) AND FechaVencimiento > DATEADD(day, -60, GETDATE()) THEN 1 ELSE 0 END) AS VARCHAR) as Valor3,
                        CAST(SUM(CASE WHEN FechaVencimiento <= DATEADD(day, -60, GETDATE()) AND FechaVencimiento > DATEADD(day, -90, GETDATE()) THEN 1 ELSE 0 END) AS VARCHAR) as Valor4,
                        CAST(SUM(CASE WHEN FechaVencimiento <= DATEADD(day, -90, GETDATE()) THEN 1 ELSE 0 END) AS VARCHAR) as Valor5
                    FROM facturas
                `;
                const agingConteoResult = await pool.request().query(agingConteoQuery);
                result.data.push(...agingConteoResult.recordset);
            } catch (error) {
                result.data.push({
                    Tipo: 'AGING_CONTEO',
                    Informacion: 'Error en aging conteo',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }

            // 10. AGING - MONTOS POR CATEGORÍAS
            try {
                const agingMontosQuery = `
                    SELECT
                        'AGING_MONTOS' as Tipo,
                        'Montos por categoría (Vigentes|0-30|30-60|60-90|90+)' as Informacion,
                        CAST(SUM(CASE WHEN FechaVencimiento > GETDATE() THEN MontoTotal ELSE 0 END) AS VARCHAR) as Valor1,
                        CAST(SUM(CASE WHEN FechaVencimiento <= GETDATE() AND FechaVencimiento > DATEADD(day, -30, GETDATE()) THEN MontoTotal ELSE 0 END) AS VARCHAR) as Valor2,
                        CAST(SUM(CASE WHEN FechaVencimiento <= DATEADD(day, -30, GETDATE()) AND FechaVencimiento > DATEADD(day, -60, GETDATE()) THEN MontoTotal ELSE 0 END) AS VARCHAR) as Valor3,
                        CAST(SUM(CASE WHEN FechaVencimiento <= DATEADD(day, -60, GETDATE()) AND FechaVencimiento > DATEADD(day, -90, GETDATE()) THEN MontoTotal ELSE 0 END) AS VARCHAR) as Valor4,
                        CAST(SUM(CASE WHEN FechaVencimiento <= DATEADD(day, -90, GETDATE()) THEN MontoTotal ELSE 0 END) AS VARCHAR) as Valor5
                    FROM facturas
                `;
                const agingMontosResult = await pool.request().query(agingMontosQuery);
                result.data.push(...agingMontosResult.recordset);
            } catch (error) {
                result.data.push({
                    Tipo: 'AGING_MONTOS',
                    Informacion: 'Error en aging montos',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }

            // 11. TOP 5 FACTURAS MÁS ALTAS
            try {
                const topFacturasQuery = `
                    SELECT TOP 5
                        'TOP_FACTURAS' as Tipo,
                        'Factura ID: ' + CAST(Id AS VARCHAR) + ' - Cliente: ' + CAST(ClienteId AS VARCHAR) as Informacion,
                        CAST(MontoTotal AS VARCHAR) as Valor1,
                        CONVERT(VARCHAR, FechaEmision, 120) as Valor2,
                        CONVERT(VARCHAR, FechaVencimiento, 120) as Valor3,
                        CAST(DATEDIFF(day, FechaVencimiento, GETDATE()) AS VARCHAR) as Valor4,
                        CASE
                            WHEN FechaVencimiento > GETDATE() THEN 'VIGENTE'
                            WHEN DATEDIFF(day, FechaVencimiento, GETDATE()) <= 30 THEN 'VENCIDA_0_30'
                            WHEN DATEDIFF(day, FechaVencimiento, GETDATE()) <= 60 THEN 'VENCIDA_30_60'
                            WHEN DATEDIFF(day, FechaVencimiento, GETDATE()) <= 90 THEN 'VENCIDA_60_90'
                            ELSE 'VENCIDA_90_MAS'
                        END as Valor5
                    FROM facturas
                    ORDER BY MontoTotal DESC
                `;
                const topFacturasResult = await pool.request().query(topFacturasQuery);
                result.data.push(...topFacturasResult.recordset);
            } catch (error) {
                result.data.push({
                    Tipo: 'TOP_FACTURAS',
                    Informacion: 'Error en top facturas',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }

            // 12. TOP 5 CLIENTES POR MONTO TOTAL
            try {
                const topClientesQuery = `
                    SELECT TOP 5
                        'TOP_CLIENTES' as Tipo,
                        'Cliente ID: ' + CAST(ClienteId AS VARCHAR) as Informacion,
                        CAST(COUNT(*) AS VARCHAR) as Valor1,
                        CAST(SUM(MontoTotal) AS VARCHAR) as Valor2,
                        CAST(AVG(MontoTotal) AS VARCHAR) as Valor3,
                        CONVERT(VARCHAR, MIN(FechaEmision), 120) as Valor4,
                        CONVERT(VARCHAR, MAX(FechaEmision), 120) as Valor5
                    FROM facturas
                    GROUP BY ClienteId
                    ORDER BY SUM(MontoTotal) DESC
                `;
                const topClientesResult = await pool.request().query(topClientesQuery);
                result.data.push(...topClientesResult.recordset);
            } catch (error) {
                result.data.push({
                    Tipo: 'TOP_CLIENTES',
                    Informacion: 'Error en top clientes',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }

            // 13. FACTURAS CRÍTICAS (MÁS VENCIDAS)
            try {
                const criticasQuery = `
                    SELECT TOP 10
                        'FACTURAS_CRITICAS' as Tipo,
                        'Factura ID: ' + CAST(Id AS VARCHAR) + ' - Cliente: ' + CAST(ClienteId AS VARCHAR) as Informacion,
                        CAST(MontoTotal AS VARCHAR) as Valor1,
                        CONVERT(VARCHAR, FechaVencimiento, 120) as Valor2,
                        CAST(DATEDIFF(day, FechaVencimiento, GETDATE()) AS VARCHAR) as Valor3,
                        CASE
                            WHEN DATEDIFF(day, FechaVencimiento, GETDATE()) <= 30 THEN 'GESTION_NORMAL'
                            WHEN DATEDIFF(day, FechaVencimiento, GETDATE()) <= 60 THEN 'GESTION_URGENTE'
                            WHEN DATEDIFF(day, FechaVencimiento, GETDATE()) <= 90 THEN 'GESTION_CRITICA'
                            ELSE 'CONSIDERAR_LITIGIO'
                        END as Valor4,
                        '' as Valor5
                    FROM facturas
                    WHERE FechaVencimiento < GETDATE()
                    ORDER BY DATEDIFF(day, FechaVencimiento, GETDATE()) DESC
                `;
                const criticasResult = await pool.request().query(criticasQuery);
                result.data.push(...criticasResult.recordset);
            } catch (error) {
                result.data.push({
                    Tipo: 'FACTURAS_CRITICAS',
                    Informacion: 'Error en facturas críticas',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }
        }

        // 14. RESUMEN EJECUTIVO FINAL
        const resumenEjecutivoQuery = `
            SELECT
                'RESUMEN_EJECUTIVO' as Tipo,
                'ANÁLISIS COMPLETADO - ' + CONVERT(VARCHAR, GETDATE(), 120) as Informacion,
                '✅ BD Analizada' as Valor1,
                '🚀 Listo para módulo Por Cobrar' as Valor2,
                '' as Valor3, '' as Valor4, '' as Valor5
        `;
        const resumenEjecutivoResult = await pool.request().query(resumenEjecutivoQuery);
        result.data.push(...resumenEjecutivoResult.recordset);

        return new Response(JSON.stringify(result, null, 2), {
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Error al analizar la base de datos',
            details: error instanceof Error ? error.message : 'Error desconocido',
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
};