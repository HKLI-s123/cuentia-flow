import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';

// GET: Registrar apertura de correo mediante tracking pixel
export const GET: RequestHandler = async (event) => {
	const { params } = event;
	const recordatorioId = params.id;

	try {
		// Actualizar el registro de recordatorio para marcar como visto
		const updateQuery = `
			UPDATE Recordatorios
			SET Visto = true,
				FechaVisto = NOW()
			WHERE Id = $1 AND Visto = false
		`;

		await db.query(updateQuery, [recordatorioId]);

		// Retornar un pixel transparente de 1x1
		const pixel = Buffer.from(
			'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
			'base64'
		);

		return new Response(pixel, {
			status: 200,
			headers: {
				'Content-Type': 'image/gif',
				'Content-Length': pixel.length.toString(),
				'Cache-Control': 'no-store, no-cache, must-revalidate, private',
				'Pragma': 'no-cache'
			}
		});

	} catch (error) {
		console.error('Error al registrar apertura:', error);

		// Incluso si hay error, retornar el pixel para no romper el correo
		const pixel = Buffer.from(
			'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
			'base64'
		);

		return new Response(pixel, {
			status: 200,
			headers: {
				'Content-Type': 'image/gif',
				'Content-Length': pixel.length.toString()
			}
		});
	}
};
