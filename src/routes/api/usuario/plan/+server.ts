import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { PLAN_LIMITS } from '$lib/server/stripe';

// Nombres legibles de cada plan
const PLAN_NOMBRES: Record<string, string> = {
	free: 'Gratuito',
	basico: 'Básico',
	pro: 'Profesional',
	enterprise: 'Empresarial'
};

/**
 * GET /api/usuario/plan
 * Obtiene información del plan del usuario y cuántas organizaciones puede crear
 */
export const GET: RequestHandler = async (event) => {
	try {
		if (!event.locals.user) {
			return json({ error: 'No autorizado' }, { status: 401 });
		}

		const userId = event.locals.user.id;
		const pool = await getConnection();

		// Obtener el mejor plan del usuario desde Suscripciones (a través de sus organizaciones)
		let planId = 'free';
		try {
			const subResult = await pool
				.query(
			`
					SELECT s.planseleccionado
					FROM Suscripciones s
					INNER JOIN Usuario_Organizacion uo ON s.organizacionid = uo.organizacionid
					WHERE uo.usuarioid = $1
						AND s.estado IN ('active', 'trialing')
					ORDER BY CASE s.planseleccionado
						WHEN 'enterprise' THEN 4
						WHEN 'pro' THEN 3
						WHEN 'basico' THEN 2
						ELSE 1
					END DESC
				LIMIT 1
			`,
			[userId]
		);

			if (subResult.rows.length > 0 && subResult.rows[0].planseleccionado) {
				planId = subResult.rows[0].planseleccionado;
			}
		} catch (err) {
			console.warn('[PLAN] Error consultando Suscripciones:', err);
		}

		const limites = PLAN_LIMITS[planId] || PLAN_LIMITS['free'];
		const nombre = PLAN_NOMBRES[planId] || 'Gratuito';

		// Contar organizaciones del usuario
		const orgCountResult = await pool
			.query(
			`
				SELECT COUNT(*) as total
				FROM Usuario_Organizacion
				WHERE UsuarioId = $1
			`,
			[userId]
		);

		const organizacionesCreadas = orgCountResult.rows[0].total;
		const organizacionesDisponibles = limites.maxOrganizaciones - organizacionesCreadas;

		return json({
			success: true,
			plan: {
				id: planId,
				nombre: nombre,
				limite: limites.maxOrganizaciones,
				creadas: organizacionesCreadas,
				disponibles: Math.max(0, organizacionesDisponibles),
				puedeContinuar: organizacionesDisponibles > 0
			}
		});
	} catch (error) {
		console.error('[API] Error al obtener plan del usuario:', error);
		return json(
			{
				error: 'Error al obtener información del plan',
				details: error instanceof Error ? error.message : 'Error desconocido'
			},
			{ status: 500 }
		);
	}
};
