/**
 * Este endpoint ya NO se usa.
 * 
 * Ahora usamos:
 * - GET  /api/auth/google/authorize  → Inicia OAuth flow
 * - GET  /api/auth/google/callback   → Callback de Google
 * 
 * Los otros endpoints (/login, /register, etc.) se manejan directamente
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	// Si alguien llega aquí, redirigir al login
	throw redirect(302, '/login');
};

