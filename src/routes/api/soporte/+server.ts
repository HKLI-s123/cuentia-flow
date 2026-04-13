import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import { RESEND_API_KEY, RESEND_FROM } from '$lib/server/email-config';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'soporte@cuentia.mx';

const CATEGORIAS_VALIDAS = ['general', 'facturacion', 'pagos', 'clientes', 'cuenta', 'bug', 'otro'];

export const POST: RequestHandler = async (event) => {
	const user = getUserFromRequest(event);
	if (!user) {
		return unauthorizedResponse('Token de autenticación requerido');
	}

	try {
		const body = await event.request.json();
		const { asunto, categoria, descripcion, organizacionId } = body;

		// Validaciones
		if (!asunto || typeof asunto !== 'string' || asunto.trim().length < 5) {
			return json({ success: false, error: 'El asunto debe tener al menos 5 caracteres' }, { status: 400 });
		}
		if (asunto.trim().length > 200) {
			return json({ success: false, error: 'El asunto no puede exceder 200 caracteres' }, { status: 400 });
		}
		if (!descripcion || typeof descripcion !== 'string' || descripcion.trim().length < 10) {
			return json({ success: false, error: 'La descripción debe tener al menos 10 caracteres' }, { status: 400 });
		}
		if (descripcion.trim().length > 5000) {
			return json({ success: false, error: 'La descripción no puede exceder 5000 caracteres' }, { status: 400 });
		}
		if (categoria && !CATEGORIAS_VALIDAS.includes(categoria)) {
			return json({ success: false, error: 'Categoría no válida' }, { status: 400 });
		}

		const pool = await getConnection();

		// Insertar ticket en BD
		const result = await pool.query(
			`INSERT INTO tickets_soporte (usuarioid, organizacionid, asunto, categoria, descripcion)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, createdat`,
			[
				user.id,
				organizacionId ? parseInt(organizacionId) : null,
				asunto.trim(),
				categoria || 'general',
				descripcion.trim()
			]
		);

		const ticket = result.rows[0];

		// Enviar email de notificación al equipo de soporte
		if (RESEND_API_KEY) {
			try {
				await fetch('https://api.resend.com/emails', {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${RESEND_API_KEY}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						from: RESEND_FROM || 'no-reply@cuentia.mx',
						to: SUPPORT_EMAIL,
						subject: `[Soporte #${ticket.id}] ${asunto.trim()}`,
						html: `
							<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
								<h2 style="color: #1e40af;">Nueva solicitud de soporte</h2>
								<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
									<tr>
										<td style="padding: 8px; font-weight: bold; color: #374151;">Ticket #</td>
										<td style="padding: 8px;">${ticket.id}</td>
									</tr>
									<tr style="background: #f9fafb;">
										<td style="padding: 8px; font-weight: bold; color: #374151;">Usuario</td>
										<td style="padding: 8px;">${user.correo}</td>
									</tr>
									<tr>
										<td style="padding: 8px; font-weight: bold; color: #374151;">Categoría</td>
										<td style="padding: 8px;">${categoria || 'general'}</td>
									</tr>
									<tr style="background: #f9fafb;">
										<td style="padding: 8px; font-weight: bold; color: #374151;">Asunto</td>
										<td style="padding: 8px;">${asunto.trim()}</td>
									</tr>
								</table>
								<div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-top: 16px;">
									<h3 style="color: #374151; margin-top: 0;">Descripción</h3>
									<p style="color: #4b5563; white-space: pre-wrap;">${descripcion.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
								</div>
								<p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">Fecha: ${new Date(ticket.createdat).toLocaleString('es-MX')}</p>
							</div>
						`
					})
				});
			} catch (emailErr) {
				console.error('[SOPORTE] Error al enviar email de notificación:', emailErr);
				// No falla el request si el email no se envía — el ticket ya está guardado
			}
		}

		return json({
			success: true,
			message: 'Tu solicitud de soporte ha sido enviada correctamente',
			ticketId: ticket.id
		}, { status: 201 });

	} catch (error) {
		console.error('[SOPORTE] Error:', error);
		return json({
			success: false,
			error: 'Error al enviar la solicitud de soporte'
		}, { status: 500 });
	}
};

// GET: Obtener historial de tickets del usuario
export const GET: RequestHandler = async (event) => {
	const user = getUserFromRequest(event);
	if (!user) {
		return unauthorizedResponse('Token de autenticación requerido');
	}

	try {
		const pool = await getConnection();

		const result = await pool.query(
			`SELECT id, asunto, categoria, descripcion, estado, createdat, updatedat
			 FROM tickets_soporte
			 WHERE usuarioid = $1
			 ORDER BY createdat DESC
			 LIMIT 50`,
			[user.id]
		);

		return json({
			success: true,
			tickets: result.rows
		});

	} catch (error) {
		console.error('[SOPORTE] Error al obtener tickets:', error);
		return json({
			success: false,
			error: 'Error al obtener el historial de soporte'
		}, { status: 500 });
	}
};
