import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

// GET: Obtener recordatorios de una factura con estadísticas
export const GET: RequestHandler = async (event) => {
	// Verificar autenticación
	const user = getUserFromRequest(event);
	if (!user) {
		return unauthorizedResponse('Token de autenticación requerido');
	}

	const { params, url } = event;
	const facturaId = params.id;
	const organizacionId = url.searchParams.get('organizacionId');

	if (!organizacionId) {
		return json({
			success: false,
			error: 'organizacionId es requerido'
		}, { status: 400 });
	}

	try {
		// Verificar que la factura pertenece a la organización
		const facturaCheck = `
			SELECT f.Id
			FROM Facturas f
			INNER JOIN Clientes c ON f.ClienteId = c.Id
			WHERE f.Id = ? AND c.OrganizacionId = ?
		`;
		const facturaResult = await db.query(facturaCheck, [facturaId, organizacionId]);

		if (!facturaResult || facturaResult.length === 0) {
			return json({
				success: false,
				error: 'Factura no encontrada'
			}, { status: 404 });
		}

		// Obtener todos los recordatorios de la factura
		const recordatoriosQuery = `
			SELECT
				Id,
				TipoMensaje,
				Destinatario,
				CC,
				Asunto,
				Mensaje,
				FechaEnvio,
				Visto,
				FechaVisto,
				MetodoEnvio,
				Estado,
				MessageId
			FROM Recordatorios
			WHERE FacturaId = ?
			ORDER BY FechaEnvio DESC
		`;
		const recordatorios = await db.query(recordatoriosQuery, [facturaId]);

		// Obtener estadísticas
		const statsQuery = `
			SELECT
				COUNT(*) as Total,
				SUM(CASE WHEN Visto = 1 THEN 1 ELSE 0 END) as Vistos,
				SUM(CASE WHEN Visto = 0 THEN 1 ELSE 0 END) as NoVistos
			FROM Recordatorios
			WHERE FacturaId = ?
		`;
		const stats = await db.query(statsQuery, [facturaId]);

		return json({
			success: true,
			recordatorios,
			stats: stats[0] || { Total: 0, Vistos: 0, NoVistos: 0 }
		});

	} catch (error) {
		console.error('Error al obtener recordatorios:', error);
		return json({
			success: false,
			error: 'Error al obtener recordatorios',
			details: error instanceof Error ? error.message : 'Error desconocido'
		}, { status: 500 });
	}
};
