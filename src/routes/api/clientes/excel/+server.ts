import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { validateOrganizationAccess } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
    try {
        const organizacionId = event.url.searchParams.get('organizacionId');

        if (!organizacionId) {
            return new Response(
                JSON.stringify({ error: 'organizacionId es requerido' }),
                { status: 400 }
            );
        }

        // Validar acceso a la organización
        const auth = await validateOrganizationAccess(event, organizacionId);
        if (!auth.valid) return auth.error!;

        const pool = await getConnection();

        // Query para obtener todos los datos completos de los clientes
        const query = `
            SELECT
                c.Id,
                COALESCE(agentes.ListaAgentes, 'Sin asignar') as AgenteDeCobranza,
                c.NombreComercial,
                c.RazonSocial,
                c.RFC,
                r.Descripcion as RegimenFiscal,
                c.CondicionesPago,
                c.CorreoPrincipal,
                p.NombrePais as Pais,
                c.CodigoPais,
                c.Telefono,
                e.NombreEstado as Estado,
                c.Calle,
                c.NumeroExterior,
                c.NumeroInterior,
                c.CodigoPostal,
                c.Colonia,
                c.Ciudad,
                0 as CuentasMXN,  -- Por ahora hardcodeado hasta tener el módulo de facturas
                0 as CuentasUSD,  -- Por ahora hardcodeado hasta tener el módulo de facturas
                c.RegimenFiscalId,
                c.PaisId,
                c.EstadoId
            FROM Clientes c
            LEFT JOIN (
                SELECT
                    ac.ClienteId,
                    STRING_AGG(CONCAT(u.Nombre, ' ', u.Apellido), ', ') as ListaAgentes
                FROM Agentes_Clientes ac
                INNER JOIN Usuarios u ON ac.UsuarioId = u.Id
                GROUP BY ac.ClienteId
            ) agentes ON c.Id = agentes.ClienteId
            LEFT JOIN Regimen r ON c.RegimenFiscalId = r.ID_Regimen
            LEFT JOIN Paises p ON c.PaisId = p.ID
            LEFT JOIN Estados e ON c.EstadoId = e.ID
            WHERE c.OrganizacionId = $1
            ORDER BY c.RazonSocial ASC
        `;

        const result = await pool.query(query, [organizacionId]);

        return new Response(
            JSON.stringify(result.rows),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

    } catch (error) {
        console.error('Error al obtener clientes para Excel:', error);
        return new Response(
            JSON.stringify({ error: 'Error interno del servidor' }),
            { status: 500 }
        );
    }
};
