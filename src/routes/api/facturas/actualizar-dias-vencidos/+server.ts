import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
  // Verificar autenticación
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }
  try {
    // Query para actualizar todos los días vencidos
    const updateQuery = `
      UPDATE Facturas
      SET DiasVencido = DATEDIFF(day, FechaVencimiento, GETDATE())
      WHERE FechaVencimiento IS NOT NULL
    `;

    const result = await db.query(updateQuery);

    // Obtener estadísticas después de la actualización
    const statsQuery = `
      SELECT
        COUNT(*) as totalFacturas,
        COUNT(CASE WHEN DiasVencido > 0 THEN 1 END) as facturasVencidas,
        COUNT(CASE WHEN DiasVencido <= 0 THEN 1 END) as facturasVigentes,
        MIN(DiasVencido) as minDiasVencido,
        MAX(DiasVencido) as maxDiasVencido,
        AVG(DiasVencido) as promedioDiasVencido
      FROM Facturas
      WHERE FechaVencimiento IS NOT NULL
    `;

    const stats = await db.query(statsQuery);
    const estadisticas = stats[0] || {};

    return json({
      success: true,
      message: 'Días vencidos actualizados correctamente',
      estadisticas: {
        totalFacturas: estadisticas.totalFacturas || 0,
        facturasVencidas: estadisticas.facturasVencidas || 0,
        facturasVigentes: estadisticas.facturasVigentes || 0,
        minDiasVencido: estadisticas.minDiasVencido || 0,
        maxDiasVencido: estadisticas.maxDiasVencido || 0,
        promedioDiasVencido: Math.round(estadisticas.promedioDiasVencido || 0)
      }
    });

  } catch (error) {
    console.error('Error actualizando días vencidos:', error);
    return json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
};