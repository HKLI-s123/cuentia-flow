import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import axios from 'axios';
import { FACTURAPI_KEY } from '$env/static/private';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	// Verificar autenticación
	const user = getUserFromRequest(event);
	if (!user) {
		return unauthorizedResponse('Token de autenticación requerido');
	}

	const { url } = event;
	const searchParams = url.searchParams;

	// Obtener parámetros de búsqueda
	const q = searchParams.get('q') || '';
	const page = parseInt(searchParams.get('page') || '1');
	const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

	try {
		// Llamar al API de Facturapi para obtener productos del catálogo SAT
		const response = await axios.get('https://www.facturapi.io/v2/catalogs/products', {
			auth: {
				username: FACTURAPI_KEY,
				password: ''
			},
			params: {
				q,
				page,
				limit
			}
		});

		return json({
			success: true,
			data: response.data.data || [],
			pagination: {
				page: response.data.page || page,
				total_pages: response.data.total_pages || 1,
				total_results: response.data.total_results || 0
			}
		});

	} catch (error) {
		console.error('Error al obtener catálogo de productos SAT:', error);
		return json({
			success: false,
			error: 'Error al obtener catálogo de productos SAT',
			details: error instanceof Error ? error.message : 'Error desconocido'
		}, { status: 500 });
	}
};
