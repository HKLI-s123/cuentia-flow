import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

export const PATCH: RequestHandler = async (event) => {
  // Verificar autenticación
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { params, request } = event;
  const facturaId = params.id; // id de la factura en la URL

  try {
    const { saldoPendiente } = await request.json();

    if (saldoPendiente === undefined) {
      return json(
        { success: false, error: 'saldoPendiente es requerido' },
        { status: 400 }
      );
    }

    // Actualizar saldo pendiente en la base de datos
    const updateQuery = `
      UPDATE Facturas
      SET SaldoPendiente = ?
      WHERE Id = ?
    `;

    const result = await db.query(updateQuery, [saldoPendiente, facturaId]);

    if ((result as any).affectedRows === 0) {
     return json(
        { success: false, error: 'Factura no encontrada o no pertenece a la organización' },
        { status: 404 }
      );
    }

    return json({
      success: true,
      message: 'Saldo pendiente actualizado correctamente',
      facturaId,
      saldoPendiente
    });
  } catch (error) {
    console.error('Error al actualizar saldo pendiente:', error);
    return json(
      {
        success: false,
        error: 'Error al actualizar saldo pendiente',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
};
