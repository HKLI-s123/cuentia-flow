import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import { RESEND_API_KEY, RESEND_FROM } from '$lib/server/email-config';
import { SUPPORT_EMAIL } from '$env/static/private';

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'srgiorosales123@gmail.com';

// Límites de validación
const LIMITS = {
	requiereFacturas: { min: 3, max: 500 },
	requiereClientes: { min: 3, max: 500 },
	requiereIntegraciones: { min: 0, max: 2000 },
	necesidesEspeciales: { min: 0, max: 3000 }
};

// Sanitizar input para prevenir XSS
function sanitizeInput(input: string): string {
	return input
		.trim()
		.replace(/[<>]/g, '') // Remover < y >
		.slice(0, 5000); // Límite máximo general
}

// Validar que el usuario tenga acceso a la organización
async function validateUserOrganizationAccess(userId: number, organizacionId: number | null): Promise<boolean> {
	if (!organizacionId) return true; // Si no especifica org, está permitido

	const pool = await getConnection();
	const result = await pool.query(
		`SELECT COUNT(*) as count FROM usuario_organizacion 
		 WHERE usuarioid = $1 AND organizacionid = $2`,
		[userId, organizacionId]
	);

	return result.rows[0].count > 0;
}

// Verificar rate limiting (máx 5 solicitudes por usuario en 24 horas)
async function checkRateLimit(userId: number): Promise<{ allowed: boolean; message?: string }> {
	const pool = await getConnection();
	const result = await pool.query(
		`SELECT COUNT(*) as count FROM solicitudes_planes_personalizados 
		 WHERE usuarioid = $1 AND createdat > NOW() - INTERVAL '24 hours'`,
		[userId]
	);

	const count = parseInt(result.rows[0].count);
	if (count >= 5) {
		return {
			allowed: false,
			message: 'Has alcanzado el límite de solicitudes. Por favor, intenta de nuevo mañana.'
		};
	}

	return { allowed: true };
}

export const POST: RequestHandler = async (event) => {
	const user = getUserFromRequest(event);
	if (!user) {
		return unauthorizedResponse('Token de autenticación requerido');
	}

	try {
		// Validar Content-Type
		const contentType = event.request.headers.get('content-type');
		if (!contentType?.includes('application/json')) {
			return json(
				{ success: false, error: 'Content-Type debe ser application/json' },
				{ status: 400 }
			);
		}

		// Validar rate limiting
		const rateLimit = await checkRateLimit(user.id);
		if (!rateLimit.allowed) {
			return json(
				{ success: false, error: rateLimit.message || 'Demasiadas solicitudes' },
				{ status: 429 }
			);
		}

		const body = await event.request.json();
		
		// Validar que el body sea un objeto
		if (typeof body !== 'object' || body === null || Array.isArray(body)) {
			return json(
				{ success: false, error: 'El cuerpo de la solicitud debe ser un objeto válido' },
				{ status: 400 }
			);
		}

		let { organizacionId, requiereFacturas, requiereClientes, requiereIntegraciones, necesidesEspeciales } = body;

		// Validar tipos
		if (typeof requiereFacturas !== 'string') {
			return json(
				{ success: false, error: 'requiereFacturas debe ser un texto' },
				{ status: 400 }
			);
		}
		if (typeof requiereClientes !== 'string') {
			return json(
				{ success: false, error: 'requiereClientes debe ser un texto' },
				{ status: 400 }
			);
		}
		if (requiereIntegraciones && typeof requiereIntegraciones !== 'string') {
			return json(
				{ success: false, error: 'requiereIntegraciones debe ser un texto' },
				{ status: 400 }
			);
		}
		if (necesidesEspeciales && typeof necesidesEspeciales !== 'string') {
			return json(
				{ success: false, error: 'necesidesEspeciales debe ser un texto' },
				{ status: 400 }
			);
		}

		// Sanitizar inputs
		requiereFacturas = sanitizeInput(requiereFacturas);
		requiereClientes = sanitizeInput(requiereClientes);
		requiereIntegraciones = requiereIntegraciones ? sanitizeInput(requiereIntegraciones) : '';
		necesidesEspeciales = necesidesEspeciales ? sanitizeInput(necesidesEspeciales) : '';

		// Validar longitudes
		if (requiereFacturas.length < LIMITS.requiereFacturas.min || requiereFacturas.length > LIMITS.requiereFacturas.max) {
			return json(
				{ success: false, error: `Facturas debe tener entre ${LIMITS.requiereFacturas.min} y ${LIMITS.requiereFacturas.max} caracteres` },
				{ status: 400 }
			);
		}

		if (requiereClientes.length < LIMITS.requiereClientes.min || requiereClientes.length > LIMITS.requiereClientes.max) {
			return json(
				{ success: false, error: `Clientes debe tener entre ${LIMITS.requiereClientes.min} y ${LIMITS.requiereClientes.max} caracteres` },
				{ status: 400 }
			);
		}

		if (requiereIntegraciones.length > LIMITS.requiereIntegraciones.max) {
			return json(
				{ success: false, error: `Integraciones no puede exceder ${LIMITS.requiereIntegraciones.max} caracteres` },
				{ status: 400 }
			);
		}

		if (necesidesEspeciales.length > LIMITS.necesidesEspeciales.max) {
			return json(
				{ success: false, error: `Necesidades especiales no puede exceder ${LIMITS.necesidesEspeciales.max} caracteres` },
				{ status: 400 }
			);
		}

		// Validar organizationId si se proporciona
		if (organizacionId) {
			if (typeof organizacionId === 'string') {
				organizacionId = parseInt(organizacionId);
			}

			if (isNaN(organizacionId) || organizacionId < 1) {
				return json(
					{ success: false, error: 'organizacionId debe ser un número válido' },
					{ status: 400 }
				);
			}

			// Verificar que el usuario tenga acceso a esta organización
			const hasAccess = await validateUserOrganizationAccess(user.id, organizacionId);
			if (!hasAccess) {
				return json(
					{ success: false, error: 'No tienes acceso a esta organización' },
					{ status: 403 }
				);
			}
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
				organizacionId || null,
				requiereFacturas,
				requiereClientes,
				requiereIntegraciones,
				necesidesEspeciales
			]
		);

		const solicitudId = result.rows[0].id;
		const createdAt = result.rows[0].createdat;

		// Logueo de auditoría
		try {
			await pool.query(
				`INSERT INTO audit_logs (usuarioid, accion, entidad, referencia_id, detalles, createdat)
				 VALUES ($1, $2, $3, $4, $5, NOW())`,
				[
					user.id,
					'crear_solicitud_plan_personalizado',
					'solicitudes_planes_personalizados',
					solicitudId,
					JSON.stringify({
						organizacionId: organizacionId || null,
						requiereFacturas: requiereFacturas.length,
						requiereClientes: requiereClientes.length
					})
				]
			);
		} catch (auditError) {
			console.error('Error registrando auditoría:', auditError);
			// No bloquear la operación si el audit log falla
		}

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

		// Enviar emails asincronamente (sin esperar)
		if (RESEND_API_KEY) {
			// Email al owner
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

			// Email de confirmación al usuario
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
						<p>Mientras tanto, si tienes alguna pregunta, puedes comunicarte al correo ${SUPPORT_EMAIL}.</p>
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

		// Validar si es un error de JSON inválido
		if (error instanceof SyntaxError) {
			return json(
				{ success: false, error: 'El formato JSON no es válido' },
				{ status: 400 }
			);
		}

		return json(
			{ success: false, error: 'Error al procesar tu solicitud. Por favor, intenta de nuevo.' },
			{ status: 500 }
		);
	}
};
