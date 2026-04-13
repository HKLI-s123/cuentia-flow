import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse, validateOrganizationAccess } from '$lib/server/auth';

/**
 * GET /api/facturas/recordatorios-stats?organizacionId=X&facturaIds=1,2,3
 * Returns recordatorios stats for multiple facturas in a single query (batch).
 */
export const GET: RequestHandler = async (event) => {
	const user = getUserFromRequest(event);
	if (!user) {
		return unauthorizedResponse('Token de autenticación requerido');
	}

	const { url } = event;
	const organizacionId = url.searchParams.get('organizacionId');
	const facturaIdsParam = url.searchParams.get('facturaIds') || '';

	if (!organizacionId) {
		return json({ success: false, error: 'organizacionId es requerido' }, { status: 400 });
	}

	// Validate org access
	const orgValidation = await validateOrganizationAccess(event, organizacionId);
	if (!orgValidation.valid) {
		return orgValidation.error!;
	}

	// Parse and validate factura IDs (max 100 to prevent abuse)
	const facturaIds = facturaIdsParam
		.split(',')
		.map(id => parseInt(id.trim()))
		.filter(id => !isNaN(id) && id > 0)
		.slice(0, 100);

	if (facturaIds.length === 0) {
		return json({ success: true, stats: {} });
	}

	try {
		// Build placeholders for IN clause
		const placeholders = facturaIds.map((_, i) => `$${i + 1}`).join(',');

		const query = `
			SELECT
				r.facturaid,
				COUNT(*) as Total,
				SUM(CASE WHEN r.estado = 'Enviado' THEN 1 ELSE 0 END) as Enviados,
				SUM(CASE WHEN r.estado = 'Fallido' THEN 1 ELSE 0 END) as Fallidos
			FROM Recordatorios r
			INNER JOIN Facturas f ON r.facturaid = f.id
			INNER JOIN Clientes c ON f.clienteid = c.id
			WHERE r.facturaid IN (${placeholders})
			AND c.organizacionid = $${facturaIds.length + 1}
			GROUP BY r.facturaid
		`;

		const results = await db.query(query, [...facturaIds, organizacionId]);

		// Build stats map
		const stats: Record<number, { total: number; enviados: number; fallidos: number }> = {};
		for (const row of results) {
			stats[row.facturaid] = {
				total: row.total || 0,
				enviados: row.enviados || 0,
				fallidos: row.fallidos || 0
			};
		}

		return json({ success: true, stats });
	} catch (error) {
		console.error('Error al obtener stats de recordatorios batch:', error);
		return json({
			success: false,
			error: 'Error interno del servidor'
		}, { status: 500 });
	}
};
