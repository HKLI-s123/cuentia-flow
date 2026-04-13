import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { reiniciarApiKeyFacturaAPI } from '$lib/server/facturapi';
/**
 * DELETE la API Key existente de una organización en FacturaAPI y genera una nueva
 * POST endpoint para reiniciar/renovar la Live API Key
 * Requiere autenticación y ser Admin (RolId = 3)
 */
export const POST: RequestHandler = async ({ url, locals, request }) => {
	try {
		// Verificar autenticación
		if (!locals.user) {
			return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
		}

		// Obtener organizacionId del body
		const body = await request.json();
		const organizacionId = body.organizacionId;

		if (!organizacionId) {
			return new Response(JSON.stringify({ error: 'organizacionId es requerido' }), { status: 400 });
		}

		const pool = await getConnection();

		// 1. Verificar que el usuario pertenece a esa organización y es Admin
		const usuarioResult = await pool
			.query(
			`
				SELECT uo.UsuarioRolId
				FROM Usuario_Organizacion uo
				WHERE uo.usuarioid = $1 AND uo.organizacionid = $2
			`,
			[locals.user.id, organizacionId]
		);

		if (usuarioResult.rows.length === 0) {
			return new Response(JSON.stringify({ error: 'No tienes acceso a esta organización' }), { status: 403 });
		}

		const usuarioRolId = usuarioResult.rows[0].usuariorolid;
		if (usuarioRolId !== 3) {
			// 3 = Admin
			return new Response(
				JSON.stringify({ error: 'Solo los administradores pueden reiniciar la API Key' }),
				{ status: 403 }
			);
		}

		// 2. Obtener idfacturapi de la organización
		const orgResult = await pool
			.query(
			`
				SELECT co.idfacturapi
				FROM Organizaciones o
				LEFT JOIN configuracion_organizacion co ON o.id = co.organizacion_id
				WHERE o.id = $1
			`,
			[organizacionId]
		);

		if (orgResult.rows.length === 0 || !orgResult.rows[0].idfacturapi) {
			return new Response(
				JSON.stringify({ 
					error: 'Organización no tiene idfacturapi configurado',
					idfacturapi: null
				}),
				{ status: 400 }
			);
		}

		const facturAPIKey = orgResult.rows[0].idfacturapi;

		// 3. Reiniciar la API Key
		const newApiKey = await reiniciarApiKeyFacturaAPI(facturAPIKey);

		if (!newApiKey) {
			return new Response(
				JSON.stringify({ 
					error: 'No se pudo reiniciar la API Key de FacturaAPI',
					detalles: 'Verifica que el idfacturapi sea válido y que FacturaAPI esté disponible'
				}),
				{ status: 500 }
			);
		}

		// 4. Guardar la nueva API Key en BD
		await pool
			.query(
			`
				UPDATE Organizaciones
				SET ApiKeyFacturaAPI = $2,
					FechaActualizacionApiKey = NOW()
				WHERE Id = $1
			`,
			[organizacionId, newApiKey]
		);

		return new Response(
			JSON.stringify({
				success: true,
				message: 'API Key reiniciada correctamente',
				nuevaApiKey: newApiKey,
				longitud: newApiKey.length,
				timestamp: new Date().toISOString()
			}),
			{ status: 200 }
		);
	} catch (error) {
		console.error('[REINICIAR API KEY] Error:', {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : ''
		});

		return new Response(
			JSON.stringify({
				error: 'Error al reiniciar la API Key',
				detalles: error instanceof Error ? error.message : String(error)
			}),
			{ status: 500 }
		);
	}
};
