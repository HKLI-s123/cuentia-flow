/**
 * Endpoint interno para recibir mensajes entrantes desde la app web.
 * El listener de Baileys en la app web reenvía los mensajes aquí
 * para que el worker los procese con IA.
 */
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import crypto from 'crypto';

/** Comparación de secretos resistente a timing attacks */
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
	// Validar secreto del worker con timing-safe comparison
	const workerSecret = request.headers.get('x-worker-secret');
	if (!env.WORKER_SECRET || !workerSecret || !secureCompare(workerSecret, env.WORKER_SECRET)) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	try {
		const message = await request.json();

		if (!message.sessionName || !message.fromPhone || !message.text) {
			return json({ error: 'Faltan campos requeridos' }, { status: 400 });
		}

		// Validar tipos y límites
		if (typeof message.sessionName !== 'string' || !/^[a-zA-Z0-9_\-]+$/.test(message.sessionName)) {
			return json({ error: 'sessionName inválido' }, { status: 400 });
		}
		if (typeof message.fromPhone !== 'string' || message.fromPhone.length > 30) {
			return json({ error: 'fromPhone inválido' }, { status: 400 });
		}
		if (typeof message.text !== 'string' || message.text.length > 5000) {
			return json({ error: 'Texto inválido o muy largo' }, { status: 400 });
		}

		// Reenviar al worker a través de HTTP
		const workerUrl = env.WORKER_URL || 'http://localhost:3847';
		const resp = await fetch(`${workerUrl}/incoming`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Worker-Secret': env.WORKER_SECRET || '',
			},
			body: JSON.stringify(message),
		});

		if (!resp.ok) {
			return json({ error: 'Worker no disponible' }, { status: 503 });
		}

		return json({ success: true });
	} catch (err) {
		console.error('[API Worker] Error procesando mensaje entrante');
		return json({ error: 'Error interno' }, { status: 500 });
	}
};
