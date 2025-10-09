import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import { FACTURAPI_KEY } from '$env/static/private';
import axios from 'axios';

export const GET: RequestHandler = async (event) => {
  // Verificar autenticación
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { params } = event;
  const { id } = params;

  try {
    // Obtener la URL del XML de la base de datos
    const query = `
      SELECT XMLUrl, numero_factura
      FROM Facturas
      WHERE Id = ?
    `;

    const result = await db.query(query, [id]);

    if (!result || result.length === 0) {
      throw error(404, 'Factura no encontrada');
    }

    const factura = result[0];

    if (!factura.XMLUrl) {
      throw error(404, 'XML no disponible para esta factura');
    }

    // Descargar el XML desde Facturapi usando autenticación
    const xmlResponse = await axios.get(factura.XMLUrl, {
      auth: {
        username: FACTURAPI_KEY,
        password: ''
      },
      responseType: 'arraybuffer'
    });

    // Retornar el XML con los headers correctos
    return new Response(xmlResponse.data, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="factura-${factura.numero_factura}.xml"`,
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (err: any) {
    console.error('Error al obtener XML:', err);
    throw error(err.status || 500, err.message || 'Error al obtener el XML');
  }
};
