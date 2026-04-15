import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Endpoint para obtener tipo de cambio automático
// Usa la API gratuita de exchangerate-api.com
export const GET: RequestHandler = async ({ url }) => {
	try {
		const moneda = url.searchParams.get('moneda') || 'USD';

		// Si es MXN, el tipo de cambio es siempre 1
		if (moneda === 'MXN') {
			return json({
				success: true,
				moneda: 'MXN',
				tipoCambio: 1.0,
				fecha: new Date().toISOString().split('T')[0]
			});
		}

		// Obtener tipo de cambio desde API pública
		// Esta API da el tipo de cambio desde USD a cualquier moneda
		// Necesitamos convertir de moneda a MXN
		const apiUrl = `https://api.exchangerate-api.com/v4/latest/${moneda}`;

		const response = await fetch(apiUrl);

		if (!response.ok) {
			throw new Error('Error al obtener tipo de cambio de la API');
		}

		const data = await response.json();

		// El tipo de cambio de la moneda seleccionada a MXN
		const tipoCambioAMXN = data.rates.MXN || 1.0;

		return json({
			success: true,
			moneda: moneda,
			tipoCambio: parseFloat(tipoCambioAMXN.toFixed(4)),
			fecha: data.date || new Date().toISOString().split('T')[0],
			tasas: {
				MXN: tipoCambioAMXN,
				USD: data.rates.USD || 1.0
			}
		});
	} catch (error) {
		// En caso de error, devolver tipo de cambio por defecto
		return json(
			{
				success: false,
				error: 'Error al obtener tipo de cambio',
				// Valores por defecto aproximados
				tipoCambio: 1.0,
				moneda: url.searchParams.get('moneda') || 'USD'
			},
			{ status: 500 }
		);
	}
};
