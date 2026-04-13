import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { stripe } from '$lib/server/stripe';
import bcrypt from 'bcryptjs';

/**
 * DELETE /api/auth/delete-account
 * Elimina la cuenta del usuario autenticado y todos sus datos asociados
 * Body: { password: string }
 */
export const DELETE: RequestHandler = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { password } = await request.json();
    if (!password) {
      return json({ error: 'La contraseña es requerida para confirmar la eliminación' }, { status: 400 });
    }

    const pool = await getConnection();

    // Verificar contraseña
    const userResult = await pool.query(
			'SELECT Contrasena FROM Usuarios WHERE Id = $1',
			[user.id]
		);

    if (userResult.rows.length === 0) {
      return json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const passwordValid = await bcrypt.compare(password, userResult.rows[0].contrasena);
    if (!passwordValid) {
      return json({ error: 'Contraseña incorrecta' }, { status: 403 });
    }

    // Cancelar suscripción de Stripe si existe
    const subResult = await pool.query(
			`
        SELECT s.stripesubscriptionid, s.stripecustomerid, s.organizacionid
        FROM Suscripciones s
        INNER JOIN Usuario_Organizacion uo ON uo.organizacionid = s.organizacionid
        WHERE uo.usuarioid = $1
      `,
			[user.id]
		);

    for (const sub of subResult.rows) {
      if (sub.stripesubscriptionid) {
        try {
          await stripe.subscriptions.cancel(sub.stripesubscriptionid);
        } catch (e: any) {
          console.error(`[DELETE ACCOUNT] Error cancelando suscripción:`, e.message);
        }
      }
    }

    // Obtener organizaciones donde el usuario es el único administrador
    const orgsResult = await pool.query(
			`
        SELECT uo.organizacionid
        FROM Usuario_Organizacion uo
        WHERE uo.usuarioid = $1
      `,
			[user.id]
		);

    const orgIds = orgsResult.rows.map((r: any) => r.organizacionid);

    // Eliminar datos del usuario y sus organizaciones (si es único miembro)
    for (const orgId of orgIds) {
      // Verificar si hay otros usuarios en la organización
      const otherUsers = await pool.query(
			`
          SELECT COUNT(*) as total FROM Usuario_Organizacion
          WHERE OrganizacionId = $1 AND UsuarioId != $2
        `,
			[orgId, user.id]
		);

      if (otherUsers.rows[0].total === 0) {
        // Es el único usuario: eliminar toda la organización y sus datos
        await pool.query(
			`
            DELETE FROM PagosSuscripcion WHERE SuscripcionId IN (SELECT Id FROM Suscripciones WHERE OrganizacionId = $1);
            DELETE FROM Suscripciones WHERE OrganizacionId = $1;
            DELETE FROM Pagos WHERE FacturaId IN (SELECT f.id FROM Facturas f INNER JOIN Clientes c ON f.clienteid = c.id WHERE c.organizacionid = $1);
            DELETE FROM Facturas WHERE ClienteId IN (SELECT Id FROM Clientes WHERE OrganizacionId = $1);
            DELETE FROM Clientes WHERE OrganizacionId = $1;
            DELETE FROM configuracion_organizacion WHERE OrganizacionId = $1;
            DELETE FROM Usuario_Organizacion WHERE OrganizacionId = $1;
            DELETE FROM Organizaciones WHERE Id = $1;
          `,
			[orgId]
		);
      } else {
        // Hay otros usuarios: solo quitar al usuario de la organización
        await pool.query(
			'DELETE FROM Usuario_Organizacion WHERE OrganizacionId = $1 AND UsuarioId = $2',
			[orgId, user.id]
		);
      }
    }

    // Eliminar el usuario
    await pool.query(
			'DELETE FROM Usuarios WHERE Id = $1',
			[user.id]
		);

    return json({ success: true });
  } catch (err: any) {
    console.error('[DELETE ACCOUNT] Error:', err.message);
    return json({ error: 'Error al eliminar la cuenta' }, { status: 500 });
  }
};
