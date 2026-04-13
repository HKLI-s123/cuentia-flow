import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { checkRateLimit, getClientIP } from '$lib/server/security';

/**
 * Resolver orgId del usuario y verificar que le pertenece
 */
async function resolveAndVerifyOrgId(user: any, pool: any): Promise<{ orgId: number | null; error?: Response }> {
  let orgId = user.organizacion;
  if (!orgId) {
    const uo = await pool.query(
			`SELECT organizacionid FROM usuario_organizacion WHERE usuarioid = $1 ORDER BY fechaasignacion DESC LIMIT 1`,
			[user.id]
		);
    orgId = uo.rows[0]?.organizacionid;
  }
  if (!orgId) return { orgId: null };

  // Verificar que el usuario pertenece a esta organización
  const accessCheck = await pool.query(
			'SELECT COUNT(*) as c FROM Usuario_Organizacion WHERE UsuarioId = $1 AND OrganizacionId = $2',
			[user.id, orgId]
		);
  if (accessCheck.rows[0].c === 0) {
    return { orgId: null, error: json({ error: 'No tienes acceso a esta organización' }, { status: 403 }) };
  }

  return { orgId };
}

/**
 * GET /api/stripe/facturacion
 * Obtiene los datos de facturación de la organización del usuario
 */
export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const pool = await getConnection();
    const { orgId, error } = await resolveAndVerifyOrgId(user, pool);
    if (error) return error;

    if (!orgId) {
      return json({ datos: null });
    }

    const result = await pool.query(
			`
        SELECT d.id, d.requierefactura, d.rfc, d.razonsocial, d.regimenfiscalid,
               d.usocfdi, d.correo, d.codigopostal,
               r.codigo as RegimenCodigo, r.descripcion as RegimenDescripcion
        FROM DatosFacturacionSuscripcion d
        INNER JOIN Regimen r ON d.regimenfiscalid = r.id_regimen
        WHERE d.organizacionid = $1
      `,
			[orgId]
		);

    if (result.rows.length === 0) {
      return json({ datos: null });
    }

    const row = result.rows[0];
    return json({
      datos: {
        requiereFactura: row.requierefactura,
        rfc: row.rfc,
        razonSocial: row.razonsocial,
        regimenFiscalId: row.regimenfiscalid,
        regimenCodigo: row.RegimenCodigo,
        regimenDescripcion: row.RegimenDescripcion,
        usoCFDI: row.usocfdi,
        correo: row.correo,
        codigoPostal: row.codigopostal,
      }
    });
  } catch (err: any) {
    console.error('[Facturación] Error obteniendo datos:', err.message);
    return json({ error: 'Error obteniendo datos de facturación' }, { status: 500 });
  }
};

/**
 * POST /api/stripe/facturacion
 * Guarda o actualiza los datos de facturación de la organización
 * Body: { requiereFactura, rfc, razonSocial, regimenFiscalId, usoCFDI, correo, codigoPostal }
 */
export const POST: RequestHandler = async (event) => {
  const { request, locals } = event;
  const user = locals.user;
  if (!user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  // Rate limit: máximo 10 actualizaciones de facturación por usuario cada 15 minutos
  const clientIP = getClientIP(event);
  const rateCheck = checkRateLimit(`stripe_facturacion:${user.id}:${clientIP}`, 10, 15);
  if (!rateCheck.allowed) {
    return json({ error: 'Demasiados intentos. Intenta de nuevo más tarde.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { requiereFactura, rfc, razonSocial, regimenFiscalId, usoCFDI, correo, codigoPostal } = body;

    if (typeof requiereFactura !== 'boolean') {
      return json({ error: 'requiereFactura es requerido' }, { status: 400 });
    }

    // Si requiere factura, validar campos obligatorios
    if (requiereFactura) {
      if (!rfc || !razonSocial || !regimenFiscalId || !correo || !codigoPostal) {
        return json({ error: 'Todos los campos fiscales son obligatorios cuando se requiere factura' }, { status: 400 });
      }

      // Validar RFC formato
      const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
      if (!rfcRegex.test(rfc.toUpperCase())) {
        return json({ error: 'RFC con formato inválido' }, { status: 400 });
      }

      // Validar código postal (5 dígitos)
      if (!/^\d{5}$/.test(codigoPostal)) {
        return json({ error: 'Código postal inválido (debe ser 5 dígitos)' }, { status: 400 });
      }

      // Validar email con regex más estricta
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(correo) || correo.length > 255) {
        return json({ error: 'Correo electrónico inválido' }, { status: 400 });
      }

      // Validar longitudes máximas
      if (razonSocial.length > 255) {
        return json({ error: 'Razón social demasiado larga (máx 255 caracteres)' }, { status: 400 });
      }
    }

    const pool = await getConnection();
    const { orgId, error } = await resolveAndVerifyOrgId(user, pool);
    if (error) return error;

    if (!orgId) {
      return json({ error: 'No tienes una organización' }, { status: 404 });
    }

    // Upsert datos de facturación
    await pool.query(
			`
        INSERT INTO DatosFacturacionSuscripcion (OrganizacionId, RequiereFactura, RFC, RazonSocial, RegimenFiscalId, UsoCFDI, Correo, CodigoPostal, CreatedAt, UpdatedAt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (organizacionid) DO UPDATE SET
            RequiereFactura = EXCLUDED.RequiereFactura,
            RFC = EXCLUDED.RFC,
            RazonSocial = EXCLUDED.RazonSocial,
            RegimenFiscalId = EXCLUDED.RegimenFiscalId,
            UsoCFDI = EXCLUDED.UsoCFDI,
            Correo = EXCLUDED.Correo,
            CodigoPostal = EXCLUDED.CodigoPostal,
            UpdatedAt = NOW()
      `,
			[orgId, requiereFactura, requiereFactura ? rfc.toUpperCase() : '', requiereFactura ? razonSocial : '', requiereFactura ? regimenFiscalId : 1, requiereFactura ? (usoCFDI || 'G03') : 'G03', requiereFactura ? correo : '', requiereFactura ? codigoPostal : '00000']
		);

    return json({ success: true, message: requiereFactura ? 'Datos de facturación guardados' : 'Preferencia actualizada' });
  } catch (err: any) {
    console.error('[Facturación] Error guardando datos:', err.message);
    return json({ error: 'Error guardando datos de facturación' }, { status: 500 });
  }
};
