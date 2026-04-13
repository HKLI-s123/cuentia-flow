/**
 * Health check endpoint para el Worker.
 * Verifica que la sesión de Baileys esté realmente conectada.
 * Autenticado con WORKER_SECRET.
 */
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getSessionStatus, getOrRestoreSession } from '$lib/server/baileys';
import { env } from '$env/dynamic/private';
import crypto from 'crypto';

function secureCompare(a: string, b: string): boolean {
	if (!a || !b) return false;
	const bufA = Buffer.from(a, 'utf-8');
	const bufB = Buffer.from(b, 'utf-8');
	if (bufA.length !== bufB.length) {
		crypto.timingSafeEqual(bufA, bufA);
		return false;
	}
	return crypto.timingSafeEqual(bufA, bufB);
}

export const POST: RequestHandler = async ({ request }) => {
	const workerSecret = request.headers.get('x-worker-secret');
	if (!env.WORKER_SECRET || !workerSecret || !secureCompare(workerSecret, env.WORKER_SECRET)) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	try {
		const { sessionName, autoRestore } = await request.json();

		if (!sessionName || typeof sessionName !== 'string' || !/^[a-zA-Z0-9_\-]+$/.test(sessionName)) {
			return json({ error: 'sessionName inválido' }, { status: 400 });
		}

		const status = getSessionStatus(sessionName);

		// Si no está conectada y autoRestore=true, intentar restaurar
		if (status.status !== 'activo' && autoRestore) {
			const socket = await getOrRestoreSession(sessionName);
			if (socket?.user) {
				const newStatus = getSessionStatus(sessionName);
				return json({ ...newStatus, restored: true });
			} else {
				return json({ status: 'error', error: 'No se pudo restaurar la sesión', restored: false });
			}
		}

		return json(status);
	} catch (err) {
		console.error('[HEALTH] Error:', err);
		return json({ error: 'Error interno' }, { status: 500 });
	}
};
