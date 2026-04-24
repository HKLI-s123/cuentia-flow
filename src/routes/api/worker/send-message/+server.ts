/**
 * Endpoint interno para el Worker del Cobrador Autónomo.
 * Envía mensajes de WhatsApp usando la sesión activa de Baileys.
 * Autenticado con WORKER_SECRET (no requiere sesión de usuario).
 */
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getOrRestoreSession, sendMessage } from '$lib/server/baileys';
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

/** Tamaño máximo de documento base64 (5 MB) */
const MAX_DOC_SIZE = 7_000_000;

export const POST: RequestHandler = async ({ request }) => {
	// Validar secreto del worker con timing-safe comparison
	const workerSecret = (request.headers.get('x-worker-secret') || '').trim();
	const expectedSecret = (process.env.WORKER_SECRET || env.WORKER_SECRET || '').trim();
	if (!expectedSecret || !workerSecret || !secureCompare(workerSecret, expectedSecret)) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	try {
		const { sessionName, jid, text, documentBase64, mimetype, fileName } = await request.json();

		if (!sessionName || !jid || !text) {
			return json({ error: 'Faltan parámetros: sessionName, jid, text' }, { status: 400 });
		}

		if (typeof text !== 'string' || text.length > 2000) {
			return json({ error: 'Texto inválido o muy largo' }, { status: 400 });
		}

		// Validar sessionName: solo alfanuméricos, guiones bajos y guiones
		if (typeof sessionName !== 'string' || !/^[a-zA-Z0-9_\-]+$/.test(sessionName)) {
			return json({ error: 'sessionName inválido' }, { status: 400 });
		}

		// Validar JID: formato esperado
		if (typeof jid !== 'string' || !/^\d+@(s\.whatsapp\.net|lid)$/.test(jid)) {
			return json({ error: 'JID inválido' }, { status: 400 });
		}

		// Validar tamaño de documento si se envía
		if (documentBase64 && typeof documentBase64 === 'string' && documentBase64.length > MAX_DOC_SIZE) {
			return json({ error: 'Documento excede el tamaño máximo (5 MB)' }, { status: 413 });
		}

		// Obtener o restaurar la sesión de Baileys
		const socket = await getOrRestoreSession(sessionName);
		if (!socket) {
			return json({ error: `Sesión ${sessionName} no disponible` }, { status: 503 });
		}

		// Enviar mensaje (con documento opcional)
		const msgPayload: { text: string; document?: Buffer; mimetype?: string; fileName?: string } = { text };
		if (documentBase64 && typeof documentBase64 === 'string') {
			msgPayload.document = Buffer.from(documentBase64, 'base64');
			msgPayload.mimetype = mimetype || 'application/pdf';
			msgPayload.fileName = fileName || 'documento.pdf';
		}

		const result = await sendMessage(sessionName, jid, msgPayload);
		return json({ success: true, messageId: result?.messageId });
	} catch (err) {
		console.error('[API Worker] Error enviando mensaje');
		return json({ error: 'Error interno' }, { status: 500 });
	}
};
