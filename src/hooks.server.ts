import { json, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { verifyAccessToken, verifyRefreshToken, generateAccessToken, generateRefreshToken } from '$lib/server/tokens';
import { getConnection } from '$lib/server/db';
import { env as privateEnv } from '$env/dynamic/private';
import crypto from 'crypto';
import { getClientIP, validateCSRFToken, secureLog, getSecurityHeaders } from '$lib/server/security';

// Lista de rutas públicas que NO requieren autenticación
const PUBLIC_ROUTES = [
	'/api/login',
	'/api/auth/register',
	'/api/auth/refresh',
	'/api/auth/logout',
	'/api/auth/csrf',
	'/',
	'/login',
	'/register',
	'/recuperar',
	'/reset-password',
	'/verify-email',
	'/nosotros',
	'/faq',
	'/terminos',
	'/aviso-privacidad',
	'/comprobante',
	'/api/comprobante-publico',
	'/api/auth/password-reset'
];

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',');

// Auto-restore de WhatsApp Baileys sessions
let baileysRestored = false;
async function autoRestoreBaileys() {
	if (baileysRestored) return;
	baileysRestored = true;
	try {
		const { existsSync, readdirSync } = await import('fs');
		const path = await import('path');
		const authDir = path.join(process.cwd(), '.whatsapp', 'auth_info');
		if (!existsSync(authDir)) return;
		const sessions = readdirSync(authDir).filter(
			(d) => d.startsWith('org_') && d.endsWith('_session')
		);
		if (sessions.length === 0) return;
		const { getOrRestoreSession } = await import('$lib/server/baileys');
		for (const sessionName of sessions) {
			const credsPath = path.join(authDir, sessionName, 'creds.json');
			if (!existsSync(credsPath)) continue;
			try {
				const socket = await getOrRestoreSession(sessionName);
				if (socket?.user) {
					// Session restored
				}
			} catch (err) {
				console.error(`[AUTO-RESTORE] Error restaurando ${sessionName}:`, err);
			}
		}
	} catch (err) {
		console.error('[AUTO-RESTORE] Error general:', err);
	}
}
autoRestoreBaileys();

export const handle: Handle = async ({ event, resolve }) => {
	const clientIP = getClientIP(event);

	// CORS preflight
	if (event.request.method === 'OPTIONS') {
		const origin = event.request.headers.get('origin');
		if (origin && allowedOrigins.includes(origin)) {
			return new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': origin,
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Organization-Id',
					'Access-Control-Allow-Credentials': 'true',
					'Access-Control-Max-Age': '86400'
				}
			});
		}
		return new Response(null, { status: 403 });
	}

	// Verificar si es una ruta pública
	const isPublicRoute = PUBLIC_ROUTES.some((route) => {
		return event.url.pathname === route || (route !== '/' && event.url.pathname.startsWith(route + '/'));
	});

	// CSRF validation para métodos que modifican datos
	if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(event.request.method)) {
		const isWorkerEndpoint = event.url.pathname.startsWith('/api/worker/');
		const isStripeWebhook = event.url.pathname === '/api/stripe/webhook';
		const isComprobantePublico = event.url.pathname.startsWith('/api/comprobante-publico/');

		if (isStripeWebhook || isComprobantePublico) {
			// Skip CSRF for webhooks and public endpoints
		} else if (isWorkerEndpoint) {
			// Validate worker secret
			const workerSecret = (event.request.headers.get('x-worker-secret') || '').trim();
			const expectedSecret = (process.env.WORKER_SECRET || privateEnv.WORKER_SECRET || '').trim();

			let isValid = false;
			if (expectedSecret && workerSecret) {
				const bufA = Buffer.from(workerSecret, 'utf-8');
				const bufB = Buffer.from(expectedSecret, 'utf-8');
				if (bufA.length === bufB.length) {
					isValid = crypto.timingSafeEqual(bufA, bufB);
				} else {
					crypto.timingSafeEqual(bufA, bufA);
				}
			}

			if (!isValid) {
				console.warn(`[SEGURIDAD] Worker auth fallido desde ${clientIP} (expectedLen=${expectedSecret.length}, receivedLen=${workerSecret.length})`);
				return new Response(
					JSON.stringify({ error: 'No autorizado' }),
					{ status: 401, headers: { 'Content-Type': 'application/json' } }
				);
			}
		} else {
			// CSRF token validation for login, register, and all protected routes
			const isLoginOrRegister = event.url.pathname === '/api/login' || event.url.pathname === '/api/auth/register';
			if (!isPublicRoute || isLoginOrRegister) {
				const csrfFromHeader = event.request.headers.get('X-CSRF-Token');
				const csrfFromCookie = event.cookies.get('csrf_token');

				if (!validateCSRFToken(csrfFromHeader, csrfFromCookie)) {
					secureLog('warn', 'CSRF token validation failed', {
						path: event.url.pathname,
						method: event.request.method,
						ip: clientIP
					});
					return new Response(
						JSON.stringify({ error: 'CSRF token inválido o expirado' }),
						{ status: 403, headers: { 'Content-Type': 'application/json' } }
					);
				}
			}
		}
	}

	// Token validation from HttpOnly cookies
	const accessToken = event.cookies.get('accessToken');
	const refreshToken = event.cookies.get('refreshToken');

	let accessPayload = accessToken ? verifyAccessToken(accessToken) : null;

	// Si el access token expiró pero tenemos refresh token, renovar
	if (!accessPayload && refreshToken) {
		const refreshPayload = verifyRefreshToken(refreshToken);

		if (refreshPayload) {
			const cleanPayload = {
				id: refreshPayload.id,
				correo: refreshPayload.correo,
				nombre: refreshPayload.nombre,
				apellido: refreshPayload.apellido,
				organizacion: refreshPayload.organizacion,
				rolId: refreshPayload.rolId
			};

			// Completar datos si faltan
			if (!cleanPayload.nombre || !cleanPayload.apellido) {
				try {
					const pool = await getConnection();
					const userResult = await pool.query(
						`SELECT nombre, apellido FROM usuarios WHERE id = $1`,
						[cleanPayload.id]
					);
					if (userResult.rows.length > 0) {
						cleanPayload.nombre = userResult.rows[0].nombre || cleanPayload.nombre;
						cleanPayload.apellido = userResult.rows[0].apellido || cleanPayload.apellido;
					}
				} catch (e) {
					// Ignore DB errors during refresh
				}
			}

			const newAccessToken = generateAccessToken(cleanPayload);
			event.cookies.set('accessToken', newAccessToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				maxAge: 60 * 15, // 15 minutos
				path: '/'
			});

			// Renovar refresh token si los datos cambiaron
			if (cleanPayload.nombre !== refreshPayload.nombre || cleanPayload.apellido !== refreshPayload.apellido) {
				const newRefreshToken = generateRefreshToken(cleanPayload);
				event.cookies.set('refreshToken', newRefreshToken, {
					httpOnly: true,
					secure: process.env.NODE_ENV === 'production',
					sameSite: 'lax',
					maxAge: 60 * 60 * 24 * 7, // 7 días
					path: '/'
				});
			}

			accessPayload = cleanPayload;
			event.locals.user = cleanPayload;
		} else {
			// Refresh token inválido, limpiar cookies
			event.cookies.delete('accessToken', { path: '/' });
			event.cookies.delete('refreshToken', { path: '/' });
		}
	} else if (accessPayload) {
		// Access token válido, completar datos si faltan
		if (!accessPayload.nombre || !accessPayload.apellido) {
			try {
				const pool = await getConnection();
				const userResult = await pool.query(
					`SELECT nombre, apellido FROM usuarios WHERE id = $1`,
					[accessPayload.id]
				);
				if (userResult.rows.length > 0) {
					const cleanPayload = {
						id: accessPayload.id,
						correo: accessPayload.correo,
						nombre: userResult.rows[0].nombre || accessPayload.nombre,
						apellido: userResult.rows[0].apellido || accessPayload.apellido,
						organizacion: accessPayload.organizacion,
						rolId: accessPayload.rolId
					};

					const newAccessToken = generateAccessToken(cleanPayload);
					event.cookies.set('accessToken', newAccessToken, {
						httpOnly: true,
						secure: process.env.NODE_ENV === 'production',
						sameSite: 'lax',
						maxAge: 60 * 15,
						path: '/'
					});

					if (refreshToken) {
						const newRefreshToken = generateRefreshToken(cleanPayload);
						event.cookies.set('refreshToken', newRefreshToken, {
							httpOnly: true,
							secure: process.env.NODE_ENV === 'production',
							sameSite: 'lax',
							maxAge: 60 * 60 * 24 * 7,
							path: '/'
						});
					}

					accessPayload = cleanPayload;
				}
			} catch (e) {
				// Ignore DB errors
			}
		}

		event.locals.user = accessPayload;
	}

	// Proteger rutas no públicas
	const isWorkerRoute = event.url.pathname.startsWith('/api/worker/');
	const isStripeWebhookRoute = event.url.pathname === '/api/stripe/webhook';

	if (!isPublicRoute && !isWorkerRoute && !isStripeWebhookRoute && !event.locals.user) {
		if (event.url.pathname.startsWith('/api/')) {
			return json({ error: 'No autenticado' }, { status: 401 });
		}
		throw redirect(302, '/login');
	}

	const response = await resolve(event);

	// Agregar headers de seguridad
	const headers = new Headers(response.headers);
	const securityHeaders = getSecurityHeaders();
	Object.entries(securityHeaders).forEach(([key, value]) => {
		headers.set(key, value);
	});

	// CORS headers
	const origin = event.request.headers.get('origin');
	if (origin && allowedOrigins.includes(origin)) {
		headers.set('Access-Control-Allow-Origin', origin);
		headers.set('Access-Control-Allow-Credentials', 'true');
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
};
