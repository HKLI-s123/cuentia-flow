import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import { validarAccesoFuncion } from '$lib/server/validar-plan';

/**
 * GET /api/cobrador-ia/comprobantes/imagen?id=X
 * Returns the base64 image of a specific comprobante.
 */
export const GET: RequestHandler = async (event) => {
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const comprobanteId = event.url.searchParams.get('id');
  if (!comprobanteId) {
    return json({ success: false, error: 'id es requerido' }, { status: 400 });
  }

  // Resolver orgId
  let organizacionId: string | null = event.url.searchParams.get('organizacionId');
  if (event.locals.user) {
    const pool = await getConnection();
    const usuarioOrgs = await pool.query(
			'SELECT uo.organizacionid FROM Usuario_Organizacion uo WHERE uo.usuarioid = $1',
			[event.locals.user.id]
		);

    if (usuarioOrgs.rows.length > 0) {
      let userOrgId = usuarioOrgs.rows[0].organizacionid;
      if (organizacionId && usuarioOrgs.rows.length > 1) {
        const parsedOrgId = parseInt(organizacionId);
        const orgEncontrada = usuarioOrgs.rows.find(
          (org: any) => org.organizacionid === parsedOrgId
        );
        if (orgEncontrada) userOrgId = parsedOrgId;
      }
      organizacionId = userOrgId.toString();
    }
  }

  if (!organizacionId) {
    return json({ success: false, error: 'organizacionId es requerido' }, { status: 400 });
  }

  // Validar acceso Cobrador IA según plan
  const accesoIA = await validarAccesoFuncion(parseInt(organizacionId), 'agenteIA');
  if (!accesoIA.permitido) {
    return json({ success: false, error: accesoIA.mensaje }, { status: 403 });
  }

  try {
    const pool = await getConnection();
    const result = await pool.query(
			`
        SELECT ImagenBase64, ImagenMimetype
        FROM ComprobantesRecibidos
        WHERE Id = $1 AND OrganizacionId = $2
      `,
			[parseInt(comprobanteId), parseInt(organizacionId)]
		);

    if (!result.rows.length) {
      return json({ success: false, error: 'Comprobante no encontrado' }, { status: 404 });
    }

    const { imagenbase64, imagenmimetype } = result.rows[0];

    if (!imagenbase64) {
      return json({ success: false, error: 'No hay imagen disponible' }, { status: 404 });
    }

    return json({
      success: true,
      imageBase64: imagenbase64,
      mimetype: imagenmimetype || 'image/jpeg'
    });
  } catch (error: any) {
    console.error('[COMPROBANTES-IMG] Error:', error);
    return json({ success: false, error: 'Error al obtener imagen' }, { status: 500 });
  }
};
