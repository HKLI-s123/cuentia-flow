import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    const endpoint = process.env.END_POINT || '';
    const apiRegisterUrl = process.env.API_REGISTER_URL || '';

    return json({
      endpoint,
      API_REGISTER_URL: apiRegisterUrl
    });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    return json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};
