import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	const user = getUserFromRequest(event);
	if (!user) {
		return unauthorizedResponse('Token de autenticación requerido');
	}

	try {
		const organizacionId = event.url.searchParams.get('organizacionId');
		if (!organizacionId) {
			return json({ success: false, error: 'organizacionId es requerido' }, { status: 400 });
		}

		const orgId = parseInt(organizacionId);
		const pool = await getConnection();

		// Verificar que el usuario pertenece a esta organización
		const acceso = await pool.query(
			'SELECT 1 FROM usuario_organizacion WHERE usuarioid = $1 AND organizacionid = $2',
			[user.id, orgId]
		);
		if (acceso.rows.length === 0) {
			return json({ success: false, error: 'Sin acceso a esta organización' }, { status: 403 });
		}

		// Ejecutar todas las verificaciones en paralelo
		const [clientesRes, facturasRes, pagosRes, whatsappRes] = await Promise.all([
			// 1. ¿Tiene al menos un cliente?
			pool.query(
				'SELECT COUNT(*)::int as total FROM clientes WHERE organizacionid = $1',
				[orgId]
			),
			// 2. ¿Tiene al menos una factura timbrada?
			pool.query(
				'SELECT COUNT(*)::int as total FROM facturas f INNER JOIN clientes c ON f.clienteid = c.id WHERE c.organizacionid = $1 AND f.timbrado = true',
				[orgId]
			),
			// 3. ¿Tiene al menos un pago registrado?
			pool.query(
				'SELECT COUNT(*)::int as total FROM pagos p INNER JOIN facturas f ON p.facturaid = f.id INNER JOIN clientes c ON f.clienteid = c.id WHERE c.organizacionid = $1',
				[orgId]
			),
			// 4. ¿Tiene WhatsApp conectado?
			pool.query(
				`SELECT 1 FROM Organizaciones_BaileysSession WHERE OrganizacionId = $1 AND Activo = true AND Estado = 'activo'`,
				[orgId]
			)
		]);

		const pasos = {
			cliente: clientesRes.rows[0].total > 0,
			factura: facturasRes.rows[0].total > 0,
			pago: pagosRes.rows[0].total > 0,
			whatsapp: whatsappRes.rows.length > 0
		};

		const completados = Object.values(pasos).filter(Boolean).length;
		const total = Object.keys(pasos).length;

		return json({
			success: true,
			pasos,
			completados,
			total,
			completo: completados === total
		});

	} catch (error) {
		console.error('[ONBOARDING] Error:', error);
		return json({
			success: false,
			error: 'Error al obtener progreso de onboarding'
		}, { status: 500 });
	}
};
