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
    if (!password || typeof password !== 'string') {
      return json({ error: 'La contraseña es requerida para confirmar la eliminación' }, { status: 400 });
    }

    const pool = await getConnection();

    // Verificar contraseña
    const userResult = await pool.query(
      'SELECT contrasena FROM usuarios WHERE id = $1',
      [user.id]
    );

    if (userResult.rows.length === 0) {
      return json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const passwordValid = await bcrypt.compare(password, userResult.rows[0].contrasena);
    if (!passwordValid) {
      return json({ error: 'Contraseña incorrecta' }, { status: 403 });
    }

    // Cancelar suscripciones de Stripe (fuera de transacción, es API externa)
    const subResult = await pool.query(
      `SELECT s.stripesubscriptionid
       FROM suscripciones s
       INNER JOIN usuario_organizacion uo ON uo.organizacionid = s.organizacionid
       WHERE uo.usuarioid = $1 AND s.stripesubscriptionid IS NOT NULL`,
      [user.id]
    );

    for (const sub of subResult.rows) {
      try {
        await stripe.subscriptions.cancel(sub.stripesubscriptionid);
      } catch (e: any) {
        console.error(`[DELETE ACCOUNT] Error cancelando suscripción:`, e.message);
      }
    }

    // Obtener organizaciones del usuario
    const orgsResult = await pool.query(
      'SELECT organizacionid FROM usuario_organizacion WHERE usuarioid = $1',
      [user.id]
    );
    const orgIds = orgsResult.rows.map((r: any) => r.organizacionid);

    // Usar transacción para todas las operaciones de borrado
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const orgId of orgIds) {
        const otherUsers = await client.query(
          'SELECT COUNT(*) as total FROM usuario_organizacion WHERE organizacionid = $1 AND usuarioid != $2',
          [orgId, user.id]
        );

        if (parseInt(otherUsers.rows[0].total, 10) === 0) {
          // Único usuario: eliminar toda la organización y sus datos
          const facturaSubq = '(SELECT f.id FROM facturas f INNER JOIN clientes c ON f.clienteid = c.id WHERE c.organizacionid = $1)';
          const clienteSubq = '(SELECT id FROM clientes WHERE organizacionid = $1)';
          await client.query(`DELETE FROM gestionescobranza WHERE facturaid IN ${facturaSubq}`, [orgId]);
          await client.query('DELETE FROM comprobantesrecibidos WHERE organizacionid = $1', [orgId]);
          await client.query(`DELETE FROM recordatoriosprogramados WHERE clienteid IN ${clienteSubq}`, [orgId]);
          await client.query('DELETE FROM facturaenvios WHERE organizacionid = $1', [orgId]);
          await client.query(`DELETE FROM pagos WHERE facturaid IN ${facturaSubq}`, [orgId]);
          await client.query(`DELETE FROM facturas WHERE clienteid IN ${clienteSubq}`, [orgId]);
          await client.query(`DELETE FROM agentes_clientes WHERE clienteid IN ${clienteSubq}`, [orgId]);
          await client.query('DELETE FROM clientes WHERE organizacionid = $1', [orgId]);
          await client.query('DELETE FROM pagossuscripcion WHERE suscripcionid IN (SELECT id FROM suscripciones WHERE organizacionid = $1)', [orgId]);
          await client.query('DELETE FROM suscripciones WHERE organizacionid = $1', [orgId]);
          await client.query('DELETE FROM configuracioncobranza WHERE organizacionid = $1', [orgId]);
          await client.query('DELETE FROM datosfacturacionsuscripcion WHERE organizacionid = $1', [orgId]);
          await client.query('DELETE FROM organizaciones_baileyssession WHERE organizacionid = $1', [orgId]);
          await client.query('DELETE FROM tickets_soporte WHERE organizacionid = $1', [orgId]);
          await client.query('DELETE FROM configuracion_organizacion WHERE organizacion_id = $1', [orgId]);
          await client.query('DELETE FROM usuario_organizacion WHERE organizacionid = $1', [orgId]);
          await client.query('DELETE FROM organizaciones WHERE id = $1', [orgId]);
        } else {
          // Otros usuarios existen: transferir referencias del usuario y quitar de la org
          await client.query('UPDATE facturas SET usuariocreadorid = NULL WHERE usuariocreadorid = $1 AND clienteid IN (SELECT id FROM clientes WHERE organizacionid = $2)', [user.id, orgId]);
          await client.query('UPDATE gestionescobranza SET usuarioid = (SELECT usuarioid FROM usuario_organizacion WHERE organizacionid = $2 AND usuarioid != $1 LIMIT 1) WHERE usuarioid = $1 AND facturaid IN (SELECT f.id FROM facturas f INNER JOIN clientes c ON f.clienteid = c.id WHERE c.organizacionid = $2)', [user.id, orgId]);
          await client.query('UPDATE pagos SET usuarioid = (SELECT usuarioid FROM usuario_organizacion WHERE organizacionid = $2 AND usuarioid != $1 LIMIT 1) WHERE usuarioid = $1 AND facturaid IN (SELECT f.id FROM facturas f INNER JOIN clientes c ON f.clienteid = c.id WHERE c.organizacionid = $2)', [user.id, orgId]);
          await client.query('DELETE FROM agentes_clientes WHERE usuarioid = $1 AND clienteid IN (SELECT id FROM clientes WHERE organizacionid = $2)', [user.id, orgId]);
          await client.query('DELETE FROM usuario_organizacion WHERE organizacionid = $2 AND usuarioid = $1', [user.id, orgId]);
        }
      }

      // Limpiar datos globales del usuario y eliminar
      await client.query('DELETE FROM auditoria_intentos_registro WHERE usuarioid = $1', [user.id]);
      await client.query('DELETE FROM tickets_soporte WHERE usuarioid = $1', [user.id]);
      await client.query('UPDATE audit_log SET usuario_id = NULL WHERE usuario_id = $1', [user.id]);
      await client.query('UPDATE recordatorios SET creadopor = NULL WHERE creadopor = $1', [user.id]);
      await client.query('DELETE FROM usuarios WHERE id = $1', [user.id]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return json({ success: true });
  } catch (err: any) {
    console.error('[DELETE ACCOUNT] Error:', err.message);
    return json({ error: 'Error al eliminar la cuenta' }, { status: 500 });
  }
};
