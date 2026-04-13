import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { stripe, PLAN_LIMITS, PLAN_PRICES, getPlanFromPriceId } from '$lib/server/stripe';
import { getConnection } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { checkRateLimit, getClientIP } from '$lib/server/security';

/**
 * Resolver el orgId del usuario. Si user.organizacion es null (token no actualizado),
 * busca la organización más reciente desde Usuario_Organizacion.
 */
async function resolveOrgId(user: { id: number; organizacion?: number }, pool: any): Promise<number | null> {
  if (user.organizacion) return user.organizacion;
  const result = await pool.query(
			`
      SELECT OrganizacionId
      FROM Usuario_Organizacion
      WHERE UsuarioId = $1
      ORDER BY fechaasignacion DESC
				LIMIT 1
			`,
			[user.id]
		);
  return result.rows[0]?.organizacionid || null;
}

/**
 * GET /api/stripe/subscription
 * Devuelve la suscripción actual de la organización
 */
export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const pool = await getConnection();
    const orgId = await resolveOrgId(user, pool);

    if (!orgId) {
      return json({
        plan: 'free',
        estado: 'active',
        limites: PLAN_LIMITS['free'],
        fechaInicio: null,
        fechaFinPeriodo: null,
        canceladaEn: null,
        tieneStripe: false,
      });
    }

    // Verificar que el usuario pertenece a esta organización
    const accessCheck = await pool.query(
			'SELECT COUNT(*) as c FROM Usuario_Organizacion WHERE UsuarioId = $1 AND OrganizacionId = $2',
			[user.id, orgId]
		);
    if (accessCheck.rows[0].c === 0) {
      return json({ error: 'No tienes acceso a esta organización' }, { status: 403 });
    }

    const result = await pool.query(
			`
        SELECT s.id, s.planseleccionado, s.estado, s.fechainicio, s.fechafinperiodo,
               s.fechacancelacion, s.stripecustomerid, s.stripesubscriptionid
        FROM Suscripciones s
        WHERE s.organizacionid = $1
      `,
			[orgId]
		);

    if (result.rows.length === 0) {
      return json({
        plan: 'free',
        estado: 'active',
        limites: PLAN_LIMITS['free'],
        fechaInicio: null,
        fechaFinPeriodo: null,
        canceladaEn: null,
        tieneStripe: false,
      });
    }

    const sub = result.rows[0];
    const plan = sub.planseleccionado || 'free';
    let fechaFinPeriodo = sub.fechafinperiodo;
    let descuento: { porcentaje: number; nombre: string; mesesRestantes: number | null } | null = null;

    // Sincronizar datos desde Stripe si tiene suscripción
    if (sub.stripesubscriptionid) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripesubscriptionid, {
          expand: ['discounts'],
        }) as any;

        // Sincronizar fechaFinPeriodo
        if (!fechaFinPeriodo) {
          const periodEnd = stripeSub.items?.data?.[0]?.current_period_end;
          if (periodEnd) {
            fechaFinPeriodo = new Date(periodEnd * 1000);
            await pool.query(
			'UPDATE Suscripciones SET FechaFinPeriodo = $2, UpdatedAt = NOW() WHERE Id = $1',
			[sub.id, fechaFinPeriodo]
		);
          }
        }

        // Leer descuentos activos (Stripe v21: discounts son IDs sin expand, objetos con expand)
        const discounts = stripeSub.discounts;
        if (discounts && discounts.length > 0) {
          const disc = discounts[0];
          // En v21, disc.source.coupon es un string ID del cupón
          const couponId = typeof disc.source?.coupon === 'string' ? disc.source.coupon : disc.source?.coupon?.id;
          if (couponId) {
            const coupon = await stripe.coupons.retrieve(couponId) as any;
            if (coupon.percent_off) {
              let mesesRestantes: number | null = null;
              if (coupon.duration === 'repeating' && coupon.duration_in_months && disc.end) {
                const finDescuento = new Date(disc.end * 1000);
                const ahora = new Date();
                mesesRestantes = Math.max(0,
                  (finDescuento.getFullYear() - ahora.getFullYear()) * 12 + finDescuento.getMonth() - ahora.getMonth()
                );
              }
              descuento = {
                porcentaje: coupon.percent_off,
                nombre: coupon.name || `${coupon.percent_off}% off`,
                mesesRestantes,
              };
            }
          }
        }
      } catch (e) {
        // Si falla Stripe, calcular fechaFinPeriodo como fallback
        if (!fechaFinPeriodo && sub.fechainicio) {
          fechaFinPeriodo = new Date(sub.fechainicio);
          fechaFinPeriodo.setMonth(fechaFinPeriodo.getMonth() + 1);
        }
      }
    }

    // Obtener historial de pagos recientes
    const pagosResult = await pool.query(
			`
        SELECT p.monto, p.moneda, p.estado, p.fechapago, p.urlrecibo
        FROM PagosSuscripcion p
        INNER JOIN Suscripciones s ON p.suscripcionid = s.id
        WHERE s.organizacionid = $1
        ORDER BY p.fechapago DESC
				LIMIT 5
			`,
			[orgId]
		);

    // Contar total de pagos exitosos (para elegibilidad de cupón de retención)
    const totalPagosResult = await pool.query(
			`
        SELECT COUNT(*) as total
        FROM PagosSuscripcion p
        INNER JOIN Suscripciones s ON p.suscripcionid = s.id
        WHERE s.organizacionid = $1 AND p.estado = 'paid'
      `,
			[orgId]
		);

    return json({
      plan,
      estado: sub.estado,
      limites: PLAN_LIMITS[plan] || PLAN_LIMITS['free'],
      fechaInicio: sub.fechainicio,
      fechaFinPeriodo: fechaFinPeriodo,
      canceladaEn: sub.fechacancelacion,
      tieneStripe: !!sub.stripesubscriptionid,
      pagos: pagosResult.rows,
      totalPagos: totalPagosResult.rows[0]?.total || 0,
      descuento,
    });
  } catch (err: any) {
    console.error('[Stripe] Error obteniendo suscripción:', err.message);
    return json({ error: 'Error obteniendo suscripción' }, { status: 500 });
  }
};

/**
 * POST /api/stripe/subscription
 * Abre el portal de Stripe para gestionar suscripción (cambiar plan, cancelar, métodos de pago)
 */
export const POST: RequestHandler = async (event) => {
  const { request, locals } = event;
  const user = locals.user;
  if (!user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const pool = await getConnection();
    const orgId = await resolveOrgId(user, pool);

    // Verificar que el usuario pertenece a esta organización
    if (orgId) {
      const accessCheck = await pool.query(
			'SELECT COUNT(*) as c FROM Usuario_Organizacion WHERE UsuarioId = $1 AND OrganizacionId = $2',
			[user.id, orgId]
		);
      if (accessCheck.rows[0].c === 0) {
        return json({ error: 'No tienes acceso a esta organización' }, { status: 403 });
      }
    }

    const result = await pool.query(
			'SELECT StripeCustomerId FROM Suscripciones WHERE OrganizacionId = $1',
			[orgId]
		);

    const customerId = result.rows[0]?.stripecustomerid;
    if (!customerId) {
      return json({ error: 'No tiene suscripción de pago activa' }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${request.headers.get('origin')}/dashboard/configuracion?tab=plan`,
    });

    return json({ url: session.url });
  } catch (err: any) {
    console.error('[Stripe Portal] Error:', err.message);
    return json({ error: 'Error abriendo portal de facturación' }, { status: 500 });
  }
};

/**
 * PUT /api/stripe/subscription
 * Cambiar de plan (upgrade/downgrade)
 */
export const PUT: RequestHandler = async (event) => {
  const { request, locals } = event;
  const user = locals.user;
  if (!user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  // Rate limit: máximo 5 cambios de plan por usuario cada 30 minutos
  const clientIP = getClientIP(event);
  const rateCheck = checkRateLimit(`stripe_plan_change:${user.id}:${clientIP}`, 5, 30);
  if (!rateCheck.allowed) {
    return json({ error: 'Demasiados cambios de plan. Intenta de nuevo más tarde.' }, { status: 429 });
  }

  try {
    const { plan } = await request.json();

    if (!plan || !PLAN_PRICES[plan]) {
      return json({ error: 'Plan inválido' }, { status: 400 });
    }

    const pool = await getConnection();
    const orgId = await resolveOrgId(user, pool);

    // Verificar que el usuario pertenece a esta organización
    if (orgId) {
      const accessCheck = await pool.query(
			'SELECT COUNT(*) as c FROM Usuario_Organizacion WHERE UsuarioId = $1 AND OrganizacionId = $2',
			[user.id, orgId]
		);
      if (accessCheck.rows[0].c === 0) {
        return json({ error: 'No tienes acceso a esta organización' }, { status: 403 });
      }
    }

    const result = await pool.query(
			'SELECT StripeSubscriptionId, PlanSeleccionado, Estado FROM Suscripciones WHERE OrganizacionId = $1',
			[orgId]
		);

    const sub = result.rows[0];
    if (!sub?.stripesubscriptionid) {
      // Suscripción cancelada o inexistente: redirigir a checkout
      return json({ requiresCheckout: true });
    }

    if (sub.planseleccionado === plan && sub.estado !== 'canceling') {
      return json({ error: 'Ya tienes este plan' }, { status: 400 });
    }

    // Obtener la suscripción de Stripe para encontrar el item
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripesubscriptionid) as any;
    const itemId = stripeSub.items?.data?.[0]?.id;
    if (!itemId) {
      return json({ error: 'No se encontró el item de la suscripción' }, { status: 500 });
    }

    // Si la suscripción tiene cancelación programada, reactivarla
    const updateParams: any = {
      items: [{ id: itemId, price: PLAN_PRICES[plan] }],
      proration_behavior: 'create_prorations',
      metadata: { plan },
    };
    if (stripeSub.cancel_at_period_end) {
      updateParams.cancel_at_period_end = false;
    }

    // Si tiene descuento de retención activo, eliminarlo antes de cambiar de plan
    const activeDiscounts = stripeSub.discounts;
    if (activeDiscounts && activeDiscounts.length > 0) {
      try {
        await stripe.subscriptions.deleteDiscount(sub.stripesubscriptionid);
      } catch (e: any) {
        console.error('[Stripe] Error eliminando descuento:', e.message);
      }
    }

    // Actualizar suscripción en Stripe
    const updated = await stripe.subscriptions.update(sub.stripesubscriptionid, updateParams) as any;

    // Verificar que Stripe aplicó el precio correcto
    const actualPriceId = updated.items?.data?.[0]?.price?.id;
    const expectedPriceId = PLAN_PRICES[plan];
    if (actualPriceId && actualPriceId !== expectedPriceId) {
      console.error(`[Stripe] Price mismatch: expected ${expectedPriceId}, got ${actualPriceId}`);
      return json({ error: 'Error al cambiar de plan. Contacta soporte.' }, { status: 500 });
    }

    // Actualizar en BD con plan verificado
    const verifiedPlan = actualPriceId ? (getPlanFromPriceId(actualPriceId) || plan) : plan;
    const periodEnd = updated.items?.data?.[0]?.current_period_end;
    await pool.query(
			`
        UPDATE Suscripciones
        SET StripePriceId = $2, PlanSeleccionado = $3, FechaFinPeriodo = $4,
            Estado = 'active', FechaCancelacion = NULL, MotivoCancelacion = NULL, UpdatedAt = NOW()
        WHERE OrganizacionId = $1
      `,
			[orgId, PLAN_PRICES[plan], verifiedPlan, periodEnd ? new Date(periodEnd * 1000) : null]
		);

    return json({ success: true, plan: verifiedPlan, limites: PLAN_LIMITS[verifiedPlan] });
  } catch (err: any) {
    console.error('[Stripe] Error cambiando plan:', err.message);
    return json({ error: 'Error al cambiar de plan' }, { status: 500 });
  }
};

/**
 * DELETE /api/stripe/subscription
 * Cancelar suscripción (con opción de cupón de retención)
 * Body: { motivo?: string, aplicarCupon?: boolean }
 */
export const DELETE: RequestHandler = async (event) => {
  const { request, locals } = event;
  const user = locals.user;
  if (!user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  // Rate limit: máximo 3 cancelaciones por usuario cada 60 minutos
  const clientIP = getClientIP(event);
  const rateCheck = checkRateLimit(`stripe_cancel:${user.id}:${clientIP}`, 3, 60);
  if (!rateCheck.allowed) {
    return json({ error: 'Demasiados intentos. Intenta de nuevo más tarde.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { motivo, aplicarCupon } = body as { motivo?: string; aplicarCupon?: boolean };

    const pool = await getConnection();
    const orgId = await resolveOrgId(user, pool);

    // Verificar que el usuario pertenece a esta organización
    if (orgId) {
      const accessCheck = await pool.query(
			'SELECT COUNT(*) as c FROM Usuario_Organizacion WHERE UsuarioId = $1 AND OrganizacionId = $2',
			[user.id, orgId]
		);
      if (accessCheck.rows[0].c === 0) {
        return json({ error: 'No tienes acceso a esta organización' }, { status: 403 });
      }
    }

    const result = await pool.query(
			'SELECT StripeSubscriptionId, StripeCustomerId, PlanSeleccionado FROM Suscripciones WHERE OrganizacionId = $1',
			[orgId]
		);

    const sub = result.rows[0];
    if (!sub?.stripesubscriptionid) {
      return json({ error: 'No tiene suscripción activa' }, { status: 400 });
    }

    // Si el usuario acepta el cupón de retención, aplicar descuento en vez de cancelar
    if (aplicarCupon && env.STRIPE_RETENTION_COUPON) {
      try {
        await stripe.subscriptions.update(sub.stripesubscriptionid, {
          discounts: [{ coupon: env.STRIPE_RETENTION_COUPON }],
        });
        return json({ retenido: true, mensaje: 'Se aplicó un descuento especial a tu próximo pago' });
      } catch (e: any) {
        console.error('[Stripe] Error aplicando cupón:', e.message);
        // Si falla el cupón, continuar con cancelación
      }
    }

    // Cancelar al final del periodo (no inmediato)
    await stripe.subscriptions.update(sub.stripesubscriptionid, {
      cancel_at_period_end: true,
      metadata: { cancel_reason: motivo || 'No especificado' },
    });

    // Actualizar BD con motivo
    await pool.query(
			`
        UPDATE Suscripciones
        SET Estado = 'canceling', FechaCancelacion = NOW(), MotivoCancelacion = $2, UpdatedAt = NOW()
        WHERE OrganizacionId = $1
      `,
			[orgId, (motivo || 'No especificado').substring(0, 500)]
		);

    return json({
      success: true,
      mensaje: 'Tu suscripción se cancelará al final del periodo actual. Seguirás teniendo acceso hasta entonces.'
    });
  } catch (err: any) {
    console.error('[Stripe] Error cancelando:', err.message);
    return json({ error: 'Error al cancelar suscripción' }, { status: 500 });
  }
};
