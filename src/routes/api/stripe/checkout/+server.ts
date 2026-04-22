import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStripe, PLAN_PRICES } from '$lib/server/stripe';
import { getConnection } from '$lib/server/db';
import { checkRateLimit, getClientIP } from '$lib/server/security';

/**
 * POST /api/stripe/checkout
 * Crea una Stripe Checkout Session para suscribirse a un plan
 * Body: { plan: 'basico' | 'pro' | 'enterprise' }
 */
export const POST: RequestHandler = async (event) => {
  const { request, locals } = event;
  const user = locals.user;
  if (!user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  // Rate limit: máximo 5 checkouts por usuario cada 15 minutos
  const clientIP = getClientIP(event);
  const rateCheck = checkRateLimit(`stripe_checkout:${user.id}:${clientIP}`, 5, 15);
  if (!rateCheck.allowed) {
    return json({ error: 'Demasiados intentos. Intenta de nuevo más tarde.' }, { status: 429 });
  }

  const { plan } = await request.json();

  if (!plan || !PLAN_PRICES[plan]) {
    return json({ error: 'Plan inválido' }, { status: 400 });
  }

  const priceId = PLAN_PRICES[plan];
  if (!priceId) {
    return json({ error: 'Price ID no configurado para este plan' }, { status: 500 });
  }

  try {
    const stripe = getStripe();
    const pool = await getConnection();

    // Si user.organizacion es null (usuario nuevo que acaba de crear org),
    // buscar su organización desde Usuario_Organizacion
    let orgId = user.organizacion;
    if (!orgId) {
      const userOrgResult = await pool.query(
			`
          SELECT OrganizacionId
          FROM Usuario_Organizacion
          WHERE UsuarioId = $1
          ORDER BY fechaasignacion DESC
				LIMIT 1
			`,
			[user.id]
		);
      if (userOrgResult.rows.length > 0) {
        orgId = userOrgResult.rows[0].organizacionid;
      }
    }

    if (!orgId) {
      return json({ error: 'No tienes una organización. Crea una primero.' }, { status: 404 });
    }

    // Verificar que el usuario pertenece a esta organización
    const accessCheck = await pool.query(
			'SELECT COUNT(*) as c FROM Usuario_Organizacion WHERE UsuarioId = $1 AND OrganizacionId = $2',
			[user.id, orgId]
		);
    if (accessCheck.rows[0].c === 0) {
      return json({ error: 'No tienes acceso a esta organización' }, { status: 403 });
    }

    // Obtener datos de la organización y suscripción actual
    const orgResult = await pool.query(
			`
        SELECT o.id, o.nombre, u.correo as Email,
               s.stripecustomerid, s.planseleccionado, s.stripesubscriptionid
        FROM Organizaciones o
        INNER JOIN Usuarios u ON u.id = $2
        LEFT JOIN Suscripciones s ON s.organizacionid = o.id
        WHERE o.id = $1
      `,
			[orgId, user.id]
		);

    const org = orgResult.rows[0];
    if (!org) {
      return json({ error: 'Organización no encontrada' }, { status: 404 });
    }

    // Si ya tiene suscripción activa de pago, redirigir al portal para cambiar plan
    if (org.stripesubscriptionid && org.planseleccionado !== 'free') {
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripecustomerid,
        return_url: `${request.headers.get('origin')}/dashboard/configuracion?tab=plan`,
      });
      return json({ url: session.url, type: 'portal' });
    }

    // Crear o reusar Stripe Customer
    let customerId = org.stripecustomerid;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: org.Email,
        name: org.nombre,
        metadata: {
          organizacionId: String(orgId),
          userId: String(user.id),
        },
      });
      customerId = customer.id;

      // Guardar el customer ID (crear registro si no existe)
      await pool.query(
			`
          INSERT INTO Suscripciones (OrganizacionId, StripeCustomerId, PlanSeleccionado, CreatedAt, UpdatedAt)
          VALUES ($1, $2, 'free', NOW(), NOW())
          ON CONFLICT (OrganizacionId) DO UPDATE
          SET StripeCustomerId = $2, UpdatedAt = NOW()
        `,
			[orgId, customerId]
		);
    }

    // Verificar si es primera suscripción (nunca tuvo plan de pago)
    const historialResult = await pool.query(
			`
        SELECT COUNT(*) as total FROM PagosSuscripcion p
        INNER JOIN Suscripciones s ON p.suscripcionid = s.id
        WHERE s.organizacionid = $1 AND p.estado = 'paid'
      `,
			[orgId]
		);
    const esPrimeraSuscripcion = (historialResult.rows[0]?.total || 0) === 0;

    // Crear Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${request.headers.get('origin')}/dashboard/configuracion?tab=plan&checkout=success`,
      cancel_url: `${request.headers.get('origin')}/dashboard/configuracion?tab=plan&checkout=cancel`,
      metadata: {
        organizacionId: String(orgId),
        plan,
      },
      subscription_data: {
        metadata: {
          organizacionId: String(orgId),
          plan,
        },
        ...(esPrimeraSuscripcion ? { trial_period_days: 30 } : {}),
      },
    });

    return json({ url: session.url, type: 'checkout' });
  } catch (err: any) {
    console.error('[Stripe Checkout] Error:', err.message);
    return json({ error: 'Error creando sesión de pago' }, { status: 500 });
  }
};
