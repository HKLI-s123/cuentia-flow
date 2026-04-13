import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
const FACTURAPI_USER_KEY = (process.env.FACTURAPI_USER_KEY || '').trim();

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'No autorizado' }, { status: 401 });
		}

		const organizacionId = parseInt(params.id, 10);
		if (isNaN(organizacionId)) {
			return json({ error: 'organizacion_id debe ser un número válido' }, { status: 400 });
		}

		const userId = locals.user.id;
		const pool = await getConnection();

		// Verificar permisos y obtener idfacturapi
		const permissionCheck = await pool
			.query(
			`
				SELECT uo.rolid, r.nombre as RolNombre, c.idfacturapi
				FROM Usuario_Organizacion uo
				LEFT JOIN Roles r ON uo.rolid = r.id
				LEFT JOIN configuracion_organizacion c ON uo.organizacionid = c.organizacion_id
				WHERE uo.usuarioid = $1 AND uo.organizacionid = $2
			`,
			[userId, organizacionId]
		);

		if (permissionCheck.rows.length === 0) {
			return json({ error: 'No tienes permiso para editar esta organización' }, { status: 403 });
		}

		const rol = permissionCheck.rows[0];
		if (rol.rolid !== 3) {
			return json({ error: 'Solo administradores pueden editar organizaciones' }, { status: 403 });
		}

		const facturapiOrgId: string | null = rol.idfacturapi;
		if (!facturapiOrgId) {
			return json(
				{ error: 'Esta organización no tiene un ID de Facturapi configurado' },
				{ status: 400 }
			);
		}

		if (!FACTURAPI_USER_KEY) {
			return json(
				{
					error: 'No se ha configurado la clave de Facturapi en el servidor',
					details: 'Verifica que FACTURAPI_USER_KEY esté configurada en las variables de entorno'
				},
				{ status: 500 }
			);
		}

		const formData = await request.formData();
		const file = formData.get('file');

		if (!file || !(file instanceof File)) {
			return json({ error: 'Debes enviar un archivo de imagen en el campo "file"' }, { status: 400 });
		}

		// Validaciones básicas de tamaño y tipo
		const maxSizeBytes = 500 * 1024; // 500 KB
		if (file.size > maxSizeBytes) {
			return json({ error: 'El logotipo no debe exceder 500 KB' }, { status: 400 });
		}

		const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];
		if (!allowedTypes.includes(file.type)) {
			return json({ error: 'Formato de imagen no soportado. Usa JPG, PNG o SVG.' }, { status: 400 });
		}

		// Reenviar como multipart/form-data a Facturapi
		const logoForm = new FormData();
		logoForm.append('file', file, file.name || 'logo');

		const facturapiResponse = await fetch(
			`https://www.facturapi.io/v2/organizations/${facturapiOrgId}/logo`,
			{
				method: 'PUT',
				headers: {
					Authorization: `Bearer ${FACTURAPI_USER_KEY}`
				},
				body: logoForm
			}
		);

		if (!facturapiResponse.ok) {
			let responseText = '';
			try {
				const blob = await facturapiResponse.blob();
				responseText = await blob.text();
			} catch (err) {
				responseText = '[No se pudo leer la respuesta de Facturapi]';
			}

			console.error(`[PUT LOGO] Error de Facturapi (${facturapiResponse.status}):`, responseText);

			let errorData: any = null;
			try {
				errorData = JSON.parse(responseText);
			} catch {
				errorData = { raw_response: responseText };
			}

			return json(
				{
					error: 'Error al subir logotipo en Facturapi',
					details: errorData,
					facturapi_status: facturapiResponse.status
				},
				// No propagar 401 de Facturapi al cliente
				{ status: 502 }
			);
		}

		return json({ success: true, message: 'Logotipo actualizado correctamente en Facturapi' });
	} catch (error) {
		console.error('[PUT LOGO] Error al subir logotipo:', error);
		return json(
			{
				error: 'Error en el servidor al subir el logotipo',
				details: error instanceof Error ? error.message : 'Error desconocido'
			},
			{ status: 500 }
		);
	}
};
