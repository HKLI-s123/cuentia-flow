import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
const FACTURAPI_USER_KEY = (process.env.FACTURAPI_USER_KEY || '').trim();

export const GET: RequestHandler = async ({ params, locals }) => {
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
			return json({ error: 'No tienes permiso para consultar esta organización' }, { status: 403 });
		}

		const rol = permissionCheck.rows[0];
		if (rol.rolid !== 3) {
			return json({ error: 'Solo administradores pueden consultar esta información' }, { status: 403 });
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

		const facturapiResponse = await fetch(
			`https://www.facturapi.io/v2/organizations/${facturapiOrgId}`,
			{
				method: 'GET',
				headers: {
					Authorization: `Bearer ${FACTURAPI_USER_KEY}`
				}
			}
		);

		if (!facturapiResponse.ok) {
			const errorText = await facturapiResponse.text();
			console.error(`[GET CUSTOM] Error de Facturapi (${facturapiResponse.status}):`, errorText);

			let errorData: any = null;
			try {
				errorData = JSON.parse(errorText);
			} catch {
				errorData = { raw_response: errorText };
			}

			return json(
				{
					error: 'Error al obtener la personalización desde Facturapi',
					details: errorData,
					facturapi_status: facturapiResponse.status
				},
				// IMPORTANTE: nunca propagar 401 de Facturapi al cliente
				// para que el frontend no lo interprete como sesión expirada
				{ status: 502 }
			);
		}

		const data = await facturapiResponse.json();
		const customization = data.customization || {};

		return json({
			success: true,
			customization: {
				color: customization.color ?? '',
				next_folio_number: customization.next_folio_number ?? null,
				next_folio_number_test: customization.next_folio_number_test ?? null,
				pdf_extra: customization.pdf_extra ?? {},
				has_logo: customization.has_logo ?? false
			}
		});
	} catch (error) {
		console.error('[GET CUSTOM] Error al obtener personalización:', error);
		return json(
			{
				error: 'Error en el servidor al obtener la personalización'
			},
			{ status: 500 }
		);
	}
};

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

		const body = await request.json();

		const payload: any = {};
		if (body.color && typeof body.color === 'string') {
			payload.color = body.color;
		}
		if (body.next_folio_number != null && body.next_folio_number !== '') {
			payload.next_folio_number = Number(body.next_folio_number);
		}
		if (body.next_folio_number_test != null && body.next_folio_number_test !== '') {
			payload.next_folio_number_test = Number(body.next_folio_number_test);
		}

		if (body.pdf_extra) {
			payload.pdf_extra = {
				codes: Boolean(body.pdf_extra.codes),
				product_key: Boolean(body.pdf_extra.product_key)
			};
		}

		const facturapiResponse = await fetch(
			`https://www.facturapi.io/v2/organizations/${facturapiOrgId}/customization`,
			{
				method: 'PUT',
				headers: {
					Authorization: `Bearer ${FACTURAPI_USER_KEY}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			}
		);

		if (!facturapiResponse.ok) {
			const errorText = await facturapiResponse.text();
			console.error(`[PUT CUSTOM] Error de Facturapi (${facturapiResponse.status}):`, errorText);

			let errorData: any = null;
			try {
				errorData = JSON.parse(errorText);
			} catch {
				errorData = { raw_response: errorText };
			}

			return json(
				{
					error: 'Error al actualizar la personalización en Facturapi',
					details: errorData,
					facturapi_status: facturapiResponse.status
				},
				// No propagar 401 de Facturapi al cliente
				{ status: 502 }
			);
		}

		return json({ success: true, message: 'Personalización actualizada correctamente en Facturapi' });
	} catch (error) {
		console.error('[PUT CUSTOM] Error al actualizar personalización:', error);
		return json(
			{
				error: 'Error en el servidor al actualizar la personalización'
			},
			{ status: 500 }
		);
	}
};
