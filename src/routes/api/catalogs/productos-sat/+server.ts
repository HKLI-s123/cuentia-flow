import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import axios from 'axios';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import { db } from '$lib/server/db';

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
	const organizacionId = searchParams.get('organizacionId');

	if (!organizacionId) {
		return json({
			success: false,
			error: 'organizacionId es requerido'
		}, { status: 400 });
	}

	try {
		// Obtener la API key de la organización
		const orgQuery = `
			SELECT COALESCE(co.facturapi_key, o.apikeyfacturaapi) as FacturapiKey
			FROM Organizaciones o
			LEFT JOIN configuracion_organizacion co ON o.Id = co.organizacion_id
			WHERE o.Id = ?
		`;

		const orgResult = await db.query(orgQuery, [organizacionId]);

		if (!orgResult || orgResult.length === 0) {
			return json({
				success: false,
				error: 'Organización no encontrada'
			}, { status: 404 });
		}

		const apiKey = orgResult[0].FacturapiKey;

		if (!apiKey) {
			return json({
				success: false,
				error: 'La organización no tiene configurada una API key de Facturapi'
			}, { status: 400 });
		}

		// Llamar al API de Facturapi para obtener productos del catálogo SAT
		const response = await axios.get('https://www.facturapi.io/v2/catalogs/products', {
			auth: {
				username: apiKey,
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
			error: 'Error al obtener catálogo de productos SAT'
		}, { status: 500 });
	}
};
