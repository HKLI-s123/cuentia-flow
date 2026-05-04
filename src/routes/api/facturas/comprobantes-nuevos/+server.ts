import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse, validateOrganizationAccess } from '$lib/server/auth';

/**
 * GET /api/facturas/comprobantes-nuevos?organizacionId=X
 * Obtiene facturas que tienen comprobantes nuevos sin ver (para notificaciones)
 */
export const GET: RequestHandler = async (event) => {
	const user = getUserFromRequest(event);
	if (!user) {
		return unauthorizedResponse('Token de autenticación requerido');
	}

	const { url } = event;
	const organizacionId = url.searchParams.get('organizacionId');

	if (!organizacionId) {
		return json({ success: false, error: 'organizacionId requerido' }, { status: 400 });
	}

	const orgValidation = await validateOrganizationAccess(event, organizacionId);
	if (!orgValidation.valid) {
		return orgValidation.error!;
	}

	try {
		const pool = await getConnection();

		const result = await pool.query(
			`SELECT DISTINCT f.id as facturaid, f.numero_factura,
			        cl.razonsocial as clientenombre,
			        COUNT(cf.id) FILTER (WHERE cf.visto = FALSE) as nuevos
			 FROM comprobantes_facturas cf
			 INNER JOIN Facturas f ON cf.facturaid = f.id
			 INNER JOIN Clientes cl ON f.clienteid = cl.id
			 WHERE cf.organizacionid = $1 AND cf.visto = FALSE
			 GROUP BY f.id, f.numero_factura, cl.razonsocial
			 ORDER BY f.id DESC`,
			[parseInt(organizacionId)]
		);

		return json({ success: true, facturas: result.rows });

	} catch (err) {
		console.error('[COMPROBANTES NUEVOS] Error:', err);
		return json({ success: false, error: 'Error al consultar' }, { status: 500 });
	}
};
