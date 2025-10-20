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
    // Obtener la URL del PDF y la API key de la base de datos
    const query = `
      SELECT f.PDFUrl, f.numero_factura, f.UUID, co.facturapi_key as FacturapiKey
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

    if (!factura.PDFUrl) {
      throw error(404, 'PDF no disponible para esta factura');
    }

    if (!factura.FacturapiKey) {
      throw error(400, 'La organización no tiene configurada una API key de Facturapi');
    }

    // Descargar el PDF desde Facturapi usando la API key de la organización
    const pdfResponse = await axios.get(factura.PDFUrl, {
      auth: {
        username: factura.FacturapiKey,
        password: ''
      },
      responseType: 'arraybuffer'
    });

    // Retornar el PDF con los headers correctos
    return new Response(pdfResponse.data, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${factura.UUID}.pdf"`,
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (err: any) {
    console.error('Error al obtener PDF:', err);
    throw error(err.status || 500, err.message || 'Error al obtener el PDF');
  }
};
