import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
  // Solo permitir en desarrollo
  if (process.env.NODE_ENV === 'production') {
    return json({ error: 'No disponible' }, { status: 404 });
  }
  const user = getUserFromRequest(event);
  if (!user) return unauthorizedResponse();

  try {
    // Obtener todas las facturas con sus conceptos e impuestos
    const query = `
      SELECT
        cf.Id as ConceptoId,
        cf.FacturaId,
        cf.Cantidad,
        cf.PrecioUnitario,
        cf.Subtotal,
        cf.TotalImpuestos,
        cf.Total,
        COALESCE(imp.TasaTotal, 0) as TasaTotal
      FROM ConceptosFactura cf
      LEFT JOIN (
        SELECT ConceptoId, SUM(Tasa) as TasaTotal
        FROM ImpuestosConcepto
        GROUP BY ConceptoId
      ) imp ON cf.Id = imp.ConceptoId
    `;

    const conceptos = await db.query(query, []);

    let updatedCount = 0;
    const detalles: any[] = [];

    for (const concepto of conceptos) {
      const cantidad = parseFloat(concepto.Cantidad);
      const tasaTotal = parseFloat(concepto.TasaTotal);
      const totalActual = parseFloat(concepto.Total);
      const precioActual = parseFloat(concepto.PrecioUnitario);
      const subtotalActual = parseFloat(concepto.Subtotal);
      const impuestosActual = parseFloat(concepto.TotalImpuestos);

      // Detectar si los valores están mal calculados
      // Los valores están incorrectos si:
      // 1. El Subtotal NO es igual a Total / (1 + Tasa)
      const subtotalEsperado = totalActual / (1 + tasaTotal);
      const estaIncorrecto = Math.abs(subtotalActual - subtotalEsperado) > 0.01;

      if (tasaTotal > 0 && estaIncorrecto) {
        // Recalcular desde el Total actual (que debe ser el precio final que quiso el usuario)
        const precioUnitarioSinIVA = totalActual / (1 + tasaTotal) / cantidad;
        const subtotal = precioUnitarioSinIVA * cantidad;
        const totalImpuestos = subtotal * tasaTotal;

        detalles.push({
          id: concepto.ConceptoId,
          antes: {
            precio: precioActual,
            subtotal: subtotalActual,
            impuestos: impuestosActual,
            total: totalActual
          },
          despues: {
            precio: precioUnitarioSinIVA,
            subtotal: subtotal,
            impuestos: totalImpuestos,
            total: totalActual
          }
        });

        // Actualizar concepto
        await db.query(
          `UPDATE ConceptosFactura
           SET PrecioUnitario = $1,
               Subtotal = $2,
               TotalImpuestos = $3
           WHERE Id = $4`,
          [precioUnitarioSinIVA, subtotal, totalImpuestos, concepto.ConceptoId]
        );

        // Actualizar impuestos del concepto
        await db.query(
          `UPDATE ImpuestosConcepto
           SET Monto = Tasa * $1
           WHERE ConceptoId = $2`,
          [subtotal, concepto.ConceptoId]
        );

        updatedCount++;
      }
    }

    // Actualizar MontoTotal en Facturas (debe coincidir con la suma de totales de conceptos)
    await db.query(`
      UPDATE Facturas f
      SET MontoTotal = totales.TotalFactura,
          SaldoPendiente = totales.TotalFactura - COALESCE(pagos.TotalPagado, 0)
      FROM (
        SELECT FacturaId, SUM(Total) as TotalFactura
        FROM ConceptosFactura
        GROUP BY FacturaId
      ) totales
      LEFT JOIN (
        SELECT FacturaId, SUM(Monto) as TotalPagado
        FROM Pagos
        GROUP BY FacturaId
      ) pagos ON totales.FacturaId = pagos.FacturaId
      WHERE f.Id = totales.FacturaId
    `, []);

    return json({
      success: true,
      message: `Se actualizaron ${updatedCount} conceptos correctamente`,
      updatedCount,
      detalles: detalles.slice(0, 5) // Mostrar solo los primeros 5 para no saturar la respuesta
    });

  } catch (error) {
    console.error('Error al corregir impuestos:', error);
    return json({
      success: false,
      error: 'Error al corregir impuestos',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
};
