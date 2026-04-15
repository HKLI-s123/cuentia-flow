import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
    // Solo permitir en desarrollo
    if (process.env.NODE_ENV === 'production') {
        return new Response(JSON.stringify({ error: 'No disponible' }), { status: 404 });
    }
    const user = getUserFromRequest(event);
    if (!user) return unauthorizedResponse();

    try {
        const pool = await getConnection();
        const result: any = {
            timestamp: new Date().toISOString(),
            database: 'Cobranza',
            data: []
        };

        // 1. INFORMACIÃ“N GENERAL + TABLAS DISPONIBLES
        const resumenQuery = `
            SELECT
                'RESUMEN_BD' as "Tipo",
                'Base de datos: Cobranza - Fecha: ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') as "Informacion",
                '' as "Valor1", '' as "Valor2", '' as "Valor3", '' as "Valor4", '' as "Valor5"
        `;
        const resumenResult = await pool.query(resumenQuery);
        result.data.push(...resumenResult.rows);

        const tablasQuery = `
            SELECT
                'TABLA' as "Tipo",
                table_name as "Informacion",
                '' as "Valor1", '' as "Valor2", '' as "Valor3", '' as "Valor4", '' as "Valor5"
            FROM information_schema.tables
            WHERE table_type = 'BASE TABLE'
              AND table_schema = 'public'
            ORDER BY table_name
        `;
        const tablasResult = await pool.query(tablasQuery);
        result.data.push(...tablasResult.rows);

        // 2. ESTRUCTURA COMPLETA DE TODAS LAS TABLAS
        const estructuraQuery = `
            SELECT
                'ESTRUCTURA' as "Tipo",
                t.table_name || '.' || c.column_name as "Informacion",
                CAST(c.ordinal_position AS VARCHAR) as "Valor1",
                c.data_type as "Valor2",
                c.is_nullable as "Valor3",
                COALESCE(c.column_default, '') as "Valor4",
                '' as "Valor5"
            FROM information_schema.tables t
            INNER JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
            WHERE t.table_type = 'BASE TABLE'
              AND t.table_schema = 'public'
            ORDER BY t.table_name, c.ordinal_position
        `;
        const estructuraResult = await pool.query(estructuraQuery);
        result.data.push(...estructuraResult.rows);

        // 3. RELACIONES ENTRE TABLAS
        const relacionesQuery = `
            SELECT
                'RELACION' as "Tipo",
                kcu.table_name || '.' || kcu.column_name || ' -> ' || ccu.table_name || '.' || ccu.column_name as "Informacion",
                kcu.table_name as "Valor1",
                kcu.column_name as "Valor2",
                ccu.table_name as "Valor3",
                ccu.column_name as "Valor4",
                tc.constraint_name as "Valor5"
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
            ORDER BY kcu.table_name
        `;
        const relacionesResult = await pool.query(relacionesQuery);
        result.data.push(...relacionesResult.rows);

        // 4. CONTEO DE REGISTROS (usando lÃ³gica dinÃ¡mica simplificada)
        const tablasList = tablasResult.rows.map((row: any) => row.Informacion);

        for (const tabla of tablasList) {
            try {
                const countQuery = `SELECT COUNT(*) as total FROM "${tabla}"`;
                const countResult = await pool.query(countQuery);
                const count = parseInt(countResult.rows[0].total);

                const estado = count === 0 ? 'VacÃ­a' :
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
                    SELECT
                        'MUESTRA_USUARIOS' as "Tipo",
                        'Usuario ID: ' || CAST(id AS VARCHAR) as "Informacion",
                        COALESCE(Nombre, '') as "Valor1",
                        COALESCE(Correo, '') as "Valor2",
                        CAST(COALESCE(Activo, false) AS VARCHAR) as "Valor3",
                        '' as "Valor4", '' as "Valor5"
                    FROM usuarios
                    ORDER BY id
                    LIMIT 5
                `;
                const usuariosResult = await pool.query(usuariosQuery);
                result.data.push(...usuariosResult.rows);
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
                    SELECT
                        'MUESTRA_CLIENTES' as "Tipo",
                        'Cliente ID: ' || CAST(id AS VARCHAR) as "Informacion",
                        COALESCE(NombreComercial, '') as "Valor1",
                        COALESCE(rfc, '') as "Valor2",
                        COALESCE(CorreoPrincipal, '') as "Valor3",
                        CAST(COALESCE(Id, 0) AS VARCHAR) as "Valor4",
                        '' as "Valor5"
                    FROM clientes
                    ORDER BY id
                    LIMIT 5
                `;
                const clientesResult = await pool.query(clientesQuery);
                result.data.push(...clientesResult.rows);
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
                    SELECT
                        'MUESTRA_FACTURAS' as "Tipo",
                        'Factura ID: ' || CAST(Id AS VARCHAR) as "Informacion",
                        CAST(ClienteId AS VARCHAR) as "Valor1",
                        CAST(MontoTotal AS VARCHAR) as "Valor2",
                        TO_CHAR(FechaEmision, 'YYYY-MM-DD HH24:MI:SS') as "Valor3",
                        TO_CHAR(FechaVencimiento, 'YYYY-MM-DD HH24:MI:SS') as "Valor4",
                        '' as "Valor5"
                    FROM facturas
                    ORDER BY Id
                    LIMIT 5
                `;
                const facturasResult = await pool.query(facturasQuery);
                result.data.push(...facturasResult.rows);
            } catch (error) {
                result.data.push({
                    Tipo: 'MUESTRA_FACTURAS',
                    Informacion: 'Error al obtener facturas',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }
        }

        // 8. ANÃLISIS DE FACTURAS - RESUMEN GENERAL
        if (tablasList.includes('facturas')) {
            try {
                const resumenFacturasQuery = `
                    SELECT
                        'FACTURAS_RESUMEN' as "Tipo",
                        'EstadÃ­sticas generales' as "Informacion",
                        CAST(COUNT(*) AS VARCHAR) as "Valor1",
                        CAST(SUM(MontoTotal) AS VARCHAR) as "Valor2",
                        CAST(AVG(MontoTotal) AS VARCHAR) as "Valor3",
                        TO_CHAR(MIN(FechaEmision), 'YYYY-MM-DD HH24:MI:SS') as "Valor4",
                        TO_CHAR(MAX(FechaEmision), 'YYYY-MM-DD HH24:MI:SS') as "Valor5"
                    FROM facturas
                `;
                const resumenFacturasResult = await pool.query(resumenFacturasQuery);
                result.data.push(...resumenFacturasResult.rows);
            } catch (error) {
                result.data.push({
                    Tipo: 'FACTURAS_RESUMEN',
                    Informacion: 'Error en resumen de facturas',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }

            // 9. AGING - CONTEO POR CATEGORÃAS
            try {
                const agingConteoQuery = `
                    SELECT
                        'AGING_CONTEO' as "Tipo",
                        'Facturas por categorÃ­a de vencimiento' as "Informacion",
                        CAST(SUM(CASE WHEN FechaVencimiento > NOW() THEN 1 ELSE 0 END) AS VARCHAR) as "Valor1",
                        CAST(SUM(CASE WHEN FechaVencimiento <= NOW() AND FechaVencimiento > NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) AS VARCHAR) as "Valor2",
                        CAST(SUM(CASE WHEN FechaVencimiento <= NOW() - INTERVAL '30 days' AND FechaVencimiento > NOW() - INTERVAL '60 days' THEN 1 ELSE 0 END) AS VARCHAR) as "Valor3",
                        CAST(SUM(CASE WHEN FechaVencimiento <= NOW() - INTERVAL '60 days' AND FechaVencimiento > NOW() - INTERVAL '90 days' THEN 1 ELSE 0 END) AS VARCHAR) as "Valor4",
                        CAST(SUM(CASE WHEN FechaVencimiento <= NOW() - INTERVAL '90 days' THEN 1 ELSE 0 END) AS VARCHAR) as "Valor5"
                    FROM facturas
                `;
                const agingConteoResult = await pool.query(agingConteoQuery);
                result.data.push(...agingConteoResult.rows);
            } catch (error) {
                result.data.push({
                    Tipo: 'AGING_CONTEO',
                    Informacion: 'Error en aging conteo',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }

            // 10. AGING - MONTOS POR CATEGORÃAS
            try {
                const agingMontosQuery = `
                    SELECT
                        'AGING_MONTOS' as "Tipo",
                        'Montos por categorÃ­a (Vigentes|0-30|30-60|60-90|90+)' as "Informacion",
                        CAST(SUM(CASE WHEN FechaVencimiento > NOW() THEN MontoTotal ELSE 0 END) AS VARCHAR) as "Valor1",
                        CAST(SUM(CASE WHEN FechaVencimiento <= NOW() AND FechaVencimiento > NOW() - INTERVAL '30 days' THEN MontoTotal ELSE 0 END) AS VARCHAR) as "Valor2",
                        CAST(SUM(CASE WHEN FechaVencimiento <= NOW() - INTERVAL '30 days' AND FechaVencimiento > NOW() - INTERVAL '60 days' THEN MontoTotal ELSE 0 END) AS VARCHAR) as "Valor3",
                        CAST(SUM(CASE WHEN FechaVencimiento <= NOW() - INTERVAL '60 days' AND FechaVencimiento > NOW() - INTERVAL '90 days' THEN MontoTotal ELSE 0 END) AS VARCHAR) as "Valor4",
                        CAST(SUM(CASE WHEN FechaVencimiento <= NOW() - INTERVAL '90 days' THEN MontoTotal ELSE 0 END) AS VARCHAR) as "Valor5"
                    FROM facturas
                `;
                const agingMontosResult = await pool.query(agingMontosQuery);
                result.data.push(...agingMontosResult.rows);
            } catch (error) {
                result.data.push({
                    Tipo: 'AGING_MONTOS',
                    Informacion: 'Error en aging montos',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }

            // 11. TOP 5 FACTURAS MÃS ALTAS
            try {
                const topFacturasQuery = `
                    SELECT
                        'TOP_FACTURAS' as "Tipo",
                        'Factura ID: ' || CAST(Id AS VARCHAR) || ' - Cliente: ' || CAST(ClienteId AS VARCHAR) as "Informacion",
                        CAST(MontoTotal AS VARCHAR) as "Valor1",
                        TO_CHAR(FechaEmision, 'YYYY-MM-DD HH24:MI:SS') as "Valor2",
                        TO_CHAR(FechaVencimiento, 'YYYY-MM-DD HH24:MI:SS') as "Valor3",
                        CAST(EXTRACT(DAY FROM NOW() - FechaVencimiento)::int AS VARCHAR) as "Valor4",
                        CASE
                            WHEN FechaVencimiento > NOW() THEN 'VIGENTE'
                            WHEN EXTRACT(DAY FROM NOW() - FechaVencimiento) <= 30 THEN 'VENCIDA_0_30'
                            WHEN EXTRACT(DAY FROM NOW() - FechaVencimiento) <= 60 THEN 'VENCIDA_30_60'
                            WHEN EXTRACT(DAY FROM NOW() - FechaVencimiento) <= 90 THEN 'VENCIDA_60_90'
                            ELSE 'VENCIDA_90_MAS'
                        END as "Valor5"
                    FROM facturas
                    ORDER BY MontoTotal DESC
                    LIMIT 5
                `;
                const topFacturasResult = await pool.query(topFacturasQuery);
                result.data.push(...topFacturasResult.rows);
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
                    SELECT
                        'TOP_CLIENTES' as "Tipo",
                        'Cliente ID: ' || CAST(ClienteId AS VARCHAR) as "Informacion",
                        CAST(COUNT(*) AS VARCHAR) as "Valor1",
                        CAST(SUM(MontoTotal) AS VARCHAR) as "Valor2",
                        CAST(AVG(MontoTotal) AS VARCHAR) as "Valor3",
                        TO_CHAR(MIN(FechaEmision), 'YYYY-MM-DD HH24:MI:SS') as "Valor4",
                        TO_CHAR(MAX(FechaEmision), 'YYYY-MM-DD HH24:MI:SS') as "Valor5"
                    FROM facturas
                    GROUP BY ClienteId
                    ORDER BY SUM(MontoTotal) DESC
                    LIMIT 5
                `;
                const topClientesResult = await pool.query(topClientesQuery);
                result.data.push(...topClientesResult.rows);
            } catch (error) {
                result.data.push({
                    Tipo: 'TOP_CLIENTES',
                    Informacion: 'Error en top clientes',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }

            // 13. FACTURAS CRÃTICAS (MÃS VENCIDAS)
            try {
                const criticasQuery = `
                    SELECT
                        'FACTURAS_CRITICAS' as "Tipo",
                        'Factura ID: ' || CAST(Id AS VARCHAR) || ' - Cliente: ' || CAST(ClienteId AS VARCHAR) as "Informacion",
                        CAST(MontoTotal AS VARCHAR) as "Valor1",
                        TO_CHAR(FechaVencimiento, 'YYYY-MM-DD HH24:MI:SS') as "Valor2",
                        CAST(EXTRACT(DAY FROM NOW() - FechaVencimiento)::int AS VARCHAR) as "Valor3",
                        CASE
                            WHEN EXTRACT(DAY FROM NOW() - FechaVencimiento) <= 30 THEN 'GESTION_NORMAL'
                            WHEN EXTRACT(DAY FROM NOW() - FechaVencimiento) <= 60 THEN 'GESTION_URGENTE'
                            WHEN EXTRACT(DAY FROM NOW() - FechaVencimiento) <= 90 THEN 'GESTION_CRITICA'
                            ELSE 'CONSIDERAR_LITIGIO'
                        END as "Valor4",
                        '' as "Valor5"
                    FROM facturas
                    WHERE FechaVencimiento < NOW()
                    ORDER BY EXTRACT(DAY FROM NOW() - FechaVencimiento) DESC
                    LIMIT 10
                `;
                const criticasResult = await pool.query(criticasQuery);
                result.data.push(...criticasResult.rows);
            } catch (error) {
                result.data.push({
                    Tipo: 'FACTURAS_CRITICAS',
                    Informacion: 'Error en facturas crÃ­ticas',
                    Valor1: (error as Error).message,
                    Valor2: '', Valor3: '', Valor4: '', Valor5: ''
                });
            }
        }

        // 14. RESUMEN EJECUTIVO FINAL
        const resumenEjecutivoQuery = `
            SELECT
                'RESUMEN_EJECUTIVO' as "Tipo",
                'ANÃLISIS COMPLETADO - ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') as "Informacion",
                'âœ… BD Analizada' as "Valor1",
                'ðŸš Listo para CuentIA Flow' as "Valor2",
                '' as "Valor3", '' as "Valor4", '' as "Valor5"
        `;
        const resumenEjecutivoResult = await pool.query(resumenEjecutivoQuery);
        result.data.push(...resumenEjecutivoResult.rows);

        return new Response(JSON.stringify(result, null, 2), {
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Error al analizar la base de datos',
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
};
