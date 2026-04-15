import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { validateOrganizationAccess } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
  try {
    const organizacionId = event.url.searchParams.get('organizacionId');
    if (!organizacionId) {
      return json({ error: 'organizacionId es requerido' }, { status: 400 });
    }

    // Validar acceso a la organización
    const auth = await validateOrganizationAccess(event, organizacionId);
    if (!auth.valid) return auth.error!;

    const pool = await getConnection();

    // Query para actualizar días vencidos SOLO de la organización del usuario
    await pool.query(
      `UPDATE Facturas f
       SET DiasVencido = (CURRENT_DATE - FechaVencimiento::date)
       FROM Clientes c
       WHERE f.clienteid = c.id
         AND c.organizacionid = $1
         AND f.FechaVencimiento IS NOT NULL`,
      [organizacionId]
    );

    // Obtener estadísticas de la organización
    const statsResult = await pool.query(
      `SELECT
        COUNT(*) as "totalFacturas",
        COUNT(CASE WHEN f.DiasVencido > 0 THEN 1 END) as "facturasVencidas",
        COUNT(CASE WHEN f.DiasVencido <= 0 THEN 1 END) as "facturasVigentes",
        MIN(f.DiasVencido) as "minDiasVencido",
        MAX(f.DiasVencido) as "maxDiasVencido",
        AVG(f.DiasVencido) as "promedioDiasVencido"
      FROM Facturas f
      INNER JOIN Clientes c ON f.clienteid = c.id
      WHERE c.organizacionid = $1
        AND f.FechaVencimiento IS NOT NULL`,
      [organizacionId]
    );
    const estadisticas = statsResult.rows[0] || {};

    return json({
      success: true,
      message: 'Días vencidos actualizados correctamente',
      estadisticas: {
        totalFacturas: parseInt(estadisticas.totalFacturas || '0', 10),
        facturasVencidas: parseInt(estadisticas.facturasVencidas || '0', 10),
        facturasVigentes: parseInt(estadisticas.facturasVigentes || '0', 10),
        minDiasVencido: parseInt(estadisticas.minDiasVencido || '0', 10),
        maxDiasVencido: parseInt(estadisticas.maxDiasVencido || '0', 10),
        promedioDiasVencido: Math.round(parseFloat(estadisticas.promedioDiasVencido || '0'))
      }
    });

  } catch (error) {
    console.error('Error actualizando días vencidos:', error);
    return json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
};