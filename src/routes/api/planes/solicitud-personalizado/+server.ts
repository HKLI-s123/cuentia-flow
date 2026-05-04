import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import { RESEND_API_KEY, RESEND_FROM } from '$lib/server/email-config';

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'srgiorosales123@gmail.com';

export const POST: RequestHandler = async (event) => {
	const user = getUserFromRequest(event);
	if (!user) {
		return unauthorizedResponse('Token de autenticación requerido');
	}

	try {
		const body = await event.request.json();
		const { organizacionId, requiereFacturas, requiereClientes, requiereIntegraciones, necesidesEspeciales } = body;

		// Validaciones básicas
		if (!requiereFacturas || typeof requiereFacturas !== 'string' || requiereFacturas.trim().length === 0) {
			return json(
				{ success: false, error: 'Por favor, especifica cuántas facturas necesitas por mes' },
				{ status: 400 }
			);
		}

		if (!requiereClientes || typeof requiereClientes !== 'string' || requiereClientes.trim().length === 0) {
			return json(
				{ success: false, error: 'Por favor, especifica cuántos clientes tienes o esperas tener' },
				{ status: 400 }
			);
		}

		const pool = await getConnection();

		// Insertar solicitud en BD
		const result = await pool.query(
			`INSERT INTO solicitudes_planes_personalizados 
			 (usuarioid, organizacionid, requierefacturas, requiereclientes, requiereintegraciones, necesidadesespeciales, estado)
			 VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
			 RETURNING id, createdat`,
			[
				user.id,
				organizacionId ? parseInt(organizacionId) : null,
				requiereFacturas.trim(),
				requiereClientes.trim(),
				requiereIntegraciones?.trim() || '',
				necesidesEspeciales?.trim() || ''
			]
		);

		const solicitudId = result.rows[0].id;
		const createdAt = result.rows[0].createdat;

		// Preparar email para el owner
		const asunto = `Nueva solicitud de plan personalizado - Usuario: ${user.correo}`;
		const contenidoEmail = `
			<h2>Nueva Solicitud de Plan Personalizado</h2>
			<p><strong>Usuario:</strong> ${user.correo}</p>
			<p><strong>ID de Solicitud:</strong> ${solicitudId}</p>
			<p><strong>Organizacion ID:</strong> ${organizacionId || 'N/A'}</p>
			<hr>
			<h3>Detalles de la Solicitud:</h3>
			<p><strong>Facturas por mes:</strong> ${requiereFacturas}</p>
			<p><strong>Clientes:</strong> ${requiereClientes}</p>
			<p><strong>Integraciones requeridas:</strong> ${requiereIntegraciones || 'Ninguna especificada'}</p>
			<p><strong>Necesidades especiales:</strong> ${necesidesEspeciales || 'Ninguna especificada'}</p>
			<hr>
			<p><small>Fecha de solicitud: ${new Date(createdAt).toLocaleString('es-MX')}</small></p>
		`;

		// Enviar email al owner (sin esperar respuesta)
		if (RESEND_API_KEY) {
			fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${RESEND_API_KEY}`
				},
				body: JSON.stringify({
					from: RESEND_FROM,
					to: OWNER_EMAIL,
					subject: asunto,
					html: contenidoEmail
				})
			}).catch((err) => {
				console.error('Error enviando email de solicitud personalizada:', err);
			});

			// Enviar email de confirmación al usuario
			fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${RESEND_API_KEY}`
				},
				body: JSON.stringify({
					from: RESEND_FROM,
					to: user.correo,
					subject: 'Solicitud de Plan Personalizado Recibida - Cuentia',
					html: `
						<h2>Hola ${user.nombre || 'usuario'},</h2>
						<p>Hemos recibido tu solicitud de plan personalizado. Nuestro equipo revisará tus necesidades y se pondrá en contacto contigo pronto con una propuesta personalizada.</p>
						<p><strong>Número de solicitud:</strong> #${solicitudId}</p>
						<p>Mientras tanto, si tienes alguna pregunta, puedes responder a este email.</p>
						<hr>
						<p><small>Cuentia Flow - Gestión de Facturas</small></p>
					`
				})
			}).catch((err) => {
				console.error('Error enviando email de confirmación:', err);
			});
		}

		return json(
			{
				success: true,
				message: 'Solicitud enviada correctamente. Nos pondremos en contacto pronto.',
				solicitudId: solicitudId
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error en solicitud de plan personalizado:', error);
		return json(
			{ success: false, error: 'Error al procesar tu solicitud. Por favor, intenta de nuevo.' },
			{ status: 500 }
		);
	}
};
