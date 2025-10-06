import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
    try {
        const organizacionId = url.searchParams.get('organizacionId') || '3';
        const pool = await getConnection();

        // 1. Clientes por Agente
        const clientesPorAgente = await pool.request()
            .input('organizacionId', organizacionId)
            .query(`
                SELECT
                    CONCAT(u.Nombre, ' ', u.Apellido) as agente,
                    COUNT(ac.ClienteId) as total_clientes
                FROM Agentes_Clientes ac
                INNER JOIN Usuarios u ON ac.UsuarioId = u.Id
                INNER JOIN Usuario_Organizacion uo ON u.Id = uo.UsuarioId
                WHERE uo.OrganizacionId = @organizacionId
                GROUP BY u.Id, u.Nombre, u.Apellido
                ORDER BY total_clientes DESC
            `);

        // 2. Total de clientes por organización
        const totalClientes = await pool.request()
            .input('organizacionId', organizacionId)
            .query(`
                SELECT COUNT(*) as total
                FROM Clientes c
                WHERE c.OrganizacionId = @organizacionId
            `);

        // 3. Clientes con y sin agente asignado
        const clientesAsignacion = await pool.request()
            .input('organizacionId', organizacionId)
            .query(`
                SELECT
                    CASE
                        WHEN ac.ClienteId IS NOT NULL THEN 'Con Agente'
                        ELSE 'Sin Agente'
                    END as estado,
                    COUNT(*) as total
                FROM Clientes c
                LEFT JOIN Agentes_Clientes ac ON c.Id = ac.ClienteId
                WHERE c.OrganizacionId = @organizacionId
                GROUP BY CASE
                    WHEN ac.ClienteId IS NOT NULL THEN 'Con Agente'
                    ELSE 'Sin Agente'
                END
            `);

        // 4. Verificar si existe tabla Facturas para estadísticas más avanzadas
        const tablaFacturasExiste = await pool.request()
            .query(`
                SELECT COUNT(*) as existe
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_NAME = 'Facturas'
            `);

        let facturasPorEstado: any[] = [];
        let montosFacturas: any[] = [];

        if (tablaFacturasExiste.recordset[0].existe > 0) {
            // 5. Facturas por estado (si la tabla existe)
            const facturasPorEstadoResult = await pool.request()
                .input('organizacionId', organizacionId)
                .query(`
                    SELECT
                        ISNULL(f.Estado, 'Pendiente') as estado,
                        COUNT(*) as total,
                        ISNULL(SUM(f.Total), 0) as monto_total
                    FROM Facturas f
                    INNER JOIN Clientes c ON f.ClienteId = c.Id
                    WHERE c.OrganizacionId = @organizacionId
                    GROUP BY f.Estado
                `);
            facturasPorEstado = facturasPorEstadoResult.recordset;

            // 6. Montos de facturas por mes (últimos 6 meses)
            const montosFacturasResult = await pool.request()
                .input('organizacionId', organizacionId)
                .query(`
                    SELECT
                        FORMAT(f.FechaEmision, 'MMM yyyy') as mes,
                        MONTH(f.FechaEmision) as mes_num,
                        YEAR(f.FechaEmision) as año,
                        SUM(f.Total) as total_facturado
                    FROM Facturas f
                    INNER JOIN Clientes c ON f.ClienteId = c.Id
                    WHERE c.OrganizacionId = @organizacionId
                        AND f.FechaEmision >= DATEADD(month, -6, GETDATE())
                    GROUP BY YEAR(f.FechaEmision), MONTH(f.FechaEmision), FORMAT(f.FechaEmision, 'MMM yyyy')
                    ORDER BY año, mes_num
                `);
            montosFacturas = montosFacturasResult.recordset;
        }

        return new Response(
            JSON.stringify({
                clientes_por_agente: clientesPorAgente.recordset,
                total_clientes: totalClientes.recordset[0].total,
                clientes_asignacion: clientesAsignacion.recordset,
                facturas_por_estado: facturasPorEstado,
                montos_facturas: montosFacturas,
                tiene_facturas: tablaFacturasExiste.recordset[0].existe > 0
            }),
            { status: 200 }
        );

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        return new Response(
            JSON.stringify({ error: 'Error interno del servidor' }),
            { status: 500 }
        );
    }
};