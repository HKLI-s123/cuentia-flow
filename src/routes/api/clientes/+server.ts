import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import sql from 'mssql';

export const GET: RequestHandler = async ({ url }) => {
    try {
        const organizacionId = url.searchParams.get('organizacionId');

        if (!organizacionId) {
            return new Response(
                JSON.stringify({ error: 'organizacionId es requerido' }),
                { status: 400 }
            );
        }
        const search = url.searchParams.get('search') || '';
        const all = url.searchParams.get('all') === 'true';
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '5');

        const offset = (page - 1) * pageSize;

        const pool = await getConnection();

        // Construir WHERE clause para búsqueda
        let whereClause = 'WHERE c.OrganizacionId = @organizacionId';
        if (search) {
            whereClause += ` AND (
                c.NombreComercial LIKE @search OR
                c.RazonSocial LIKE @search OR
                c.RFC LIKE @search OR
                agentes.ListaAgentes LIKE @search
            )`;
        }

        // Query principal con JOIN a Agentes_Clientes (concatenando todos los agentes)
        let query = `
            SELECT
                c.Id as id,
                c.NombreComercial as cliente,
                c.RazonSocial as razonSocial,
                c.RFC as rfc,
                c.CondicionesPago as condiciones,
                ISNULL(agentes.ListaAgentes, '') as agente,
                -- Campos adicionales
                0 as cuentasMXN,  -- Por ahora hardcodeado hasta tener el módulo de facturas
                0 as cuentasUSD   -- Por ahora hardcodeado hasta tener el módulo de facturas
            FROM Clientes c
            LEFT JOIN (
                SELECT
                    ac.ClienteId,
                    STRING_AGG(CONCAT(u.Nombre, ' ', u.Apellido), ', ') as ListaAgentes
                FROM Agentes_Clientes ac
                INNER JOIN Usuarios u ON ac.UsuarioId = u.Id
                GROUP BY ac.ClienteId
            ) agentes ON c.Id = agentes.ClienteId
            ${whereClause}
            ORDER BY c.RazonSocial ASC`;

        // Solo agregar paginación si no se solicita todos los registros
        if (!all) {
            query += `
                OFFSET @offset ROWS
                FETCH NEXT @pageSize ROWS ONLY`;
        }

        const request = pool.request()
            .input('organizacionId', organizacionId)
            .input('search', search ? `%${search}%` : '');

        // Solo agregar parámetros de paginación si no es 'all'
        if (!all) {
            request.input('offset', offset).input('pageSize', pageSize);
        }

        const result = await request.query(query);

        // Query para contar total de registros (sin JOIN para evitar duplicados)
        const countResult = await pool.request()
            .input('organizacionId', organizacionId)
            .input('search', search ? `%${search}%` : '')
            .query(`
                SELECT COUNT(DISTINCT c.Id) as total
                FROM Clientes c
                LEFT JOIN (
                    SELECT
                        ac.ClienteId,
                        STRING_AGG(CONCAT(u.Nombre, ' ', u.Apellido), ', ') as ListaAgentes
                    FROM Agentes_Clientes ac
                    INNER JOIN Usuarios u ON ac.UsuarioId = u.Id
                    GROUP BY ac.ClienteId
                ) agentes ON c.Id = agentes.ClienteId
                ${whereClause}
            `);

        const total = countResult.recordset[0].total;

        // Respuesta diferente dependiendo si se solicita todos o paginación
        if (all) {
            return new Response(
                JSON.stringify({
                    clientes: result.recordset,
                    total: total
                }),
                { status: 200 }
            );
        } else {
            const totalPages = Math.ceil(total / pageSize);
            return new Response(
                JSON.stringify({
                    clientes: result.recordset,
                    pagination: {
                        currentPage: page,
                        totalPages: totalPages,
                        totalRecords: total,
                        pageSize: pageSize
                    }
                }),
                { status: 200 }
            );
        }

    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Error interno del servidor' }),
            { status: 500 }
        );
    }
};

// POST - Crear nuevo cliente
export const POST: RequestHandler = async ({ request }) => {
	try {
		const clienteData = await request.json();

		const pool = await getConnection();

		const result = await pool
			.request()
			.input('OrganizacionId', sql.Int, clienteData.OrganizacionId)
			.input('NombreComercial', sql.NVarChar(200), clienteData.NombreComercial || null)
			.input('RazonSocial', sql.NVarChar(200), clienteData.RazonSocial || null)
			.input('RFC', sql.NVarChar(13), clienteData.RFC || null)
			.input('RegimenFiscalId', sql.Int, clienteData.RegimenFiscalId || null)
			.input('CondicionesPago', sql.NVarChar(50), clienteData.CondicionesPago || null)
			.input('CorreoPrincipal', sql.NVarChar(100), clienteData.CorreoPrincipal || null)
			.input('PaisId', sql.Int, clienteData.PaisId || null)
			.input('CodigoPais', sql.NVarChar(10), clienteData.CodigoPais || null)
			.input('Telefono', sql.NVarChar(20), clienteData.Telefono || null)
			.input('EstadoId', sql.Int, clienteData.EstadoId || null)
			.input('Calle', sql.NVarChar(200), clienteData.Calle || null)
			.input('NumeroExterior', sql.NVarChar(20), clienteData.NumeroExterior || null)
			.input('NumeroInterior', sql.NVarChar(20), clienteData.NumeroInterior || null)
			.input('CodigoPostal', sql.NVarChar(10), clienteData.CodigoPostal || null)
			.input('Colonia', sql.NVarChar(100), clienteData.Colonia || null)
			.input('Ciudad', sql.NVarChar(100), clienteData.Ciudad || null)
			.query(`
				INSERT INTO Clientes (
					OrganizacionId, NombreComercial, RazonSocial, RFC, RegimenFiscalId,
					CondicionesPago, CorreoPrincipal, PaisId, CodigoPais, Telefono,
					EstadoId, Calle, NumeroExterior, NumeroInterior, CodigoPostal,
					Colonia, Ciudad
				)
				OUTPUT INSERTED.Id
				VALUES (
					@OrganizacionId, @NombreComercial, @RazonSocial, @RFC, @RegimenFiscalId,
					@CondicionesPago, @CorreoPrincipal, @PaisId, @CodigoPais, @Telefono,
					@EstadoId, @Calle, @NumeroExterior, @NumeroInterior, @CodigoPostal,
					@Colonia, @Ciudad
				)
			`);

		const clienteId = result.recordset[0].Id;

		return new Response(
			JSON.stringify({
				message: 'Cliente creado correctamente',
				id: clienteId
			}),
			{ status: 201 }
		);
	} catch (err) {
		return new Response(JSON.stringify({ error: 'Error en el servidor' }), { status: 500 });
	}
};