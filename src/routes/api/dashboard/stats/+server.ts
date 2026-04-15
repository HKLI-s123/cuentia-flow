import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { validateOrganizationAccess } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
    try {
        const organizacionId = event.url.searchParams.get('organizacionId') || '3';

        // Validar acceso a la organización
        const auth = await validateOrganizationAccess(event, organizacionId);
        if (!auth.valid) return auth.error!;

        const pool = await getConnection();

        // 1. Clientes por Agente
        const clientesPorAgente = await pool.query(`
                SELECT
                    CONCAT(u.Nombre, ' ', u.Apellido) as agente,
                    COUNT(ac.ClienteId) as total_clientes
                FROM Agentes_Clientes ac
                INNER JOIN Usuarios u ON ac.UsuarioId = u.Id
                INNER JOIN Usuario_Organizacion uo ON u.Id = uo.UsuarioId
                WHERE uo.OrganizacionId = $1
                GROUP BY u.Id, u.Nombre, u.Apellido
                ORDER BY total_clientes DESC
            `, [organizacionId]);

        // 2. Total de clientes por organización
        const totalClientes = await pool.query(`
                SELECT COUNT(*) as total
                FROM Clientes c
                WHERE c.OrganizacionId = $1
            `, [organizacionId]);

        // 3. Clientes con y sin agente asignado
        const clientesAsignacion = await pool.query(`
                SELECT
                    CASE
                        WHEN ac.ClienteId IS NOT NULL THEN 'Con Agente'
                        ELSE 'Sin Agente'
                    END as estado,
                    COUNT(*) as total
                FROM Clientes c
                LEFT JOIN Agentes_Clientes ac ON c.Id = ac.ClienteId
                WHERE c.OrganizacionId = $1
                GROUP BY CASE
                    WHEN ac.ClienteId IS NOT NULL THEN 'Con Agente'
                    ELSE 'Sin Agente'
                END
            `, [organizacionId]);

        // 4. Verificar si existe tabla Facturas para estadísticas más avanzadas
        const tablaFacturasExiste = await pool.query(`
                SELECT COUNT(*) as existe
                FROM information_schema.tables
                WHERE table_name = 'facturas'
            `);

        let facturasPorEstado: any[] = [];
        let montosFacturas: any[] = [];

        if (parseInt(tablaFacturasExiste.rows[0].existe) > 0) {
            // 5. Facturas por estado (si la tabla existe)
            const facturasPorEstadoResult = await pool.query(`
                    SELECT
                        COALESCE(ef.codigo, 'pendiente') as estado,
                        COUNT(*) as total,
                        COALESCE(SUM(f.montototal), 0) as monto_total
                    FROM Facturas f
                    INNER JOIN Clientes c ON f.ClienteId = c.Id
                    LEFT JOIN estados_factura ef ON f.estado_factura_id = ef.id
                    WHERE c.OrganizacionId = $1
                    GROUP BY ef.codigo
                `, [organizacionId]);
            facturasPorEstado = facturasPorEstadoResult.rows;

            // 6. Montos de facturas por mes (últimos 6 meses)
            const montosFacturasResult = await pool.query(`
                    SELECT
                        TO_CHAR(f.FechaEmision, 'Mon YYYY') as mes,
                        EXTRACT(MONTH FROM f.FechaEmision)::int as mes_num,
                        EXTRACT(YEAR FROM f.FechaEmision)::int as año,
                        SUM(f.montototal) as total_facturado
                    FROM Facturas f
                    INNER JOIN Clientes c ON f.ClienteId = c.Id
                    WHERE c.OrganizacionId = $1
                        AND f.FechaEmision >= NOW() - INTERVAL '6 months'
                    GROUP BY EXTRACT(YEAR FROM f.FechaEmision), EXTRACT(MONTH FROM f.FechaEmision), TO_CHAR(f.FechaEmision, 'Mon YYYY')
                    ORDER BY año, mes_num
                `, [organizacionId]);
            montosFacturas = montosFacturasResult.rows;
        }

        return new Response(
            JSON.stringify({
                clientes_por_agente: clientesPorAgente.rows,
                total_clientes: parseInt(totalClientes.rows[0].total, 10),
                clientes_asignacion: clientesAsignacion.rows,
                facturas_por_estado: facturasPorEstado,
                montos_facturas: montosFacturas,
                tiene_facturas: parseInt(tablaFacturasExiste.rows[0].existe) > 0
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