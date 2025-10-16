import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import axios from 'axios';

export const GET: RequestHandler = async (event) => {
  // Verificar autenticación
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { params, url } = event;
  const { id } = params;
  const organizacionId = url.searchParams.get('organizacionId');

  if (!organizacionId) {
    throw error(400, 'organizacionId es requerido');
  }

  try {
    // Obtener la URL del XML y la API key de la base de datos
    const query = `
      SELECT f.XMLUrl, f.numero_factura, co.facturapi_key as FacturapiKey
      FROM Facturas f
      INNER JOIN Clientes c ON f.ClienteId = c.Id
      INNER JOIN configuracion_organizacion co ON c.OrganizacionId = co.organizacion_id
      WHERE f.Id = ? AND c.OrganizacionId = ?
    `;

    const result = await db.query(query, [id, organizacionId]);

    if (!result || result.length === 0) {
      throw error(404, 'Factura no encontrada');
    }

    const factura = result[0];

    if (!factura.XMLUrl) {
      throw error(404, 'XML no disponible para esta factura');
    }

    if (!factura.FacturapiKey) {
      throw error(400, 'La organización no tiene configurada una API key de Facturapi');
    }

    // Descargar el XML desde Facturapi usando la API key de la organización
    const xmlResponse = await axios.get(factura.XMLUrl, {
      auth: {
        username: factura.FacturapiKey,
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
