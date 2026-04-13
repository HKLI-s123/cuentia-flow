import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { stripe, getPlanFromPriceId } from '$lib/server/stripe';
import { getConnection } from '$lib/server/db';
import { env } from '$env/dynamic/private';

/**
 * POST /api/stripe/webhook
 * Recibe eventos de Stripe (checkout completado, pago, cancelación, etc.)
 * NO requiere autenticación — verificado con firma de Stripe
 */
export const POST: RequestHandler = async ({ request }) => {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event;
  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Firma inválida:', err.message);
    return json({ error: 'Invalid signature' }, { status: 400 });
  }

  const pool = await getConnection();

  try {
    switch (event.type) {
      // ═══ CHECKOUT COMPLETADO ═══
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        if (session.mode !== 'subscription') break;

        const orgId = parseInt(session.metadata?.organizacionId || '0');
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (!orgId || !subscriptionId) {
          console.error('[Stripe Webhook] checkout.session.completed sin orgId o subscriptionId');
          break;
        }

        // Obtener detalles de la suscripción
        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
        const priceId = subscription.items?.data?.[0]?.price?.id || '';
        const plan = session.metadata?.plan || getPlanFromPriceId(priceId);
        const periodEnd = subscription.items?.data?.[0]?.current_period_end;

        await pool.query(
			`
            INSERT INTO Suscripciones (OrganizacionId, StripeCustomerId, StripeSubscriptionId, StripePriceId, PlanSeleccionado, Estado, FechaInicio, FechaFinPeriodo, CreatedAt, UpdatedAt)
            VALUES ($1, $2, $3, $4, $5, 'active', NOW(), $6, NOW(), NOW())
            ON CONFLICT (organizacionid) DO UPDATE SET
                StripeCustomerId = EXCLUDED.StripeCustomerId,
                StripeSubscriptionId = EXCLUDED.StripeSubscriptionId,
                StripePriceId = EXCLUDED.StripePriceId,
                PlanSeleccionado = EXCLUDED.PlanSeleccionado,
                Estado = 'active',
                FechaInicio = NOW(),
                FechaFinPeriodo = EXCLUDED.FechaFinPeriodo,
                UpdatedAt = NOW()
          `,
			[orgId, customerId, subscriptionId, priceId, plan, periodEnd ? new Date(periodEnd * 1000) : null]
		);

        break;
      }

      // ═══ PAGO EXITOSO ═══
      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        // Buscar la suscripción local
        const subResult = await pool.query(
			'SELECT Id, OrganizacionId FROM Suscripciones WHERE StripeCustomerId = $1',
			[customerId]
		);

        if (subResult.rows.length === 0) break;
        const sub = subResult.rows[0];

        // Idempotencia: verificar si este invoice ya fue procesado
        const existingPayment = await pool.query(
			'SELECT COUNT(*) as c FROM PagosSuscripcion WHERE StripeInvoiceId = $1',
			[invoice.id]
		);
        if (existingPayment.rows[0].c > 0) {
          break;
        }

        // Registrar pago
        await pool.query(
			`
            INSERT INTO PagosSuscripcion (SuscripcionId, StripeInvoiceId, StripePaymentIntentId, Monto, Moneda, Estado, FechaPago, UrlRecibo)
            VALUES ($1, $2, $3, $4, $5, 'paid', NOW(), $6)
          `,
			[sub.id, invoice.id, invoice.payment_intent || null, (invoice.amount_paid || 0) / 100, invoice.currency || 'mxn', invoice.hosted_invoice_url || null]
		);

        // Actualizar periodo de la suscripción
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const periodEnd = subscription.items?.data?.[0]?.current_period_end;
          if (periodEnd) {
            await pool.query(
			`
                UPDATE Suscripciones
                SET Estado = 'active', FechaFinPeriodo = $2, UpdatedAt = NOW()
                WHERE OrganizacionId = $1
              `,
			[sub.organizacionid, new Date(periodEnd * 1000)]
		);
          }
        }

        break;
      }

      // ═══ PAGO FALLIDO ═══
      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;

        await pool.query(
			`
            UPDATE Suscripciones
            SET Estado = 'past_due', UpdatedAt = NOW()
            WHERE StripeCustomerId = $1
          `,
			[customerId]
		);

        break;
      }

      // ═══ SUSCRIPCIÓN ACTUALIZADA (cambio de plan, renovación) ═══
      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const priceId = subscription.items?.data?.[0]?.price?.id || '';
        const plan = subscription.metadata?.plan || getPlanFromPriceId(priceId);
        const status = subscription.status;
        const periodEnd = subscription.items?.data?.[0]?.current_period_end;
        const cancelAt = subscription.cancel_at;

        await pool.query(
			`
            UPDATE Suscripciones
            SET StripePriceId = $2,
                PlanSeleccionado = $3,
                Estado = $4,
                FechaFinPeriodo = $5,
                FechaCancelacion = $6,
                UpdatedAt = NOW()
            WHERE StripeCustomerId = $1
          `,
			[customerId, priceId, plan, status, periodEnd ? new Date(periodEnd * 1000) : null, cancelAt ? new Date(cancelAt * 1000) : null]
		);

        break;
      }

      // ═══ SUSCRIPCIÓN CANCELADA ═══
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        await pool.query(
			`
            UPDATE Suscripciones
            SET PlanSeleccionado = 'free',
                Estado = 'canceled',
                StripeSubscriptionId = NULL,
                StripePriceId = NULL,
                FechaCancelacion = NOW(),
                UpdatedAt = NOW()
            WHERE StripeCustomerId = $1
          `,
			[customerId]
		);

        break;
      }

      default:
    }
  } catch (err: any) {
    console.error(`[Stripe Webhook] Error procesando ${event.type}:`, err.message);
    // Siempre retornar 200 para que Stripe no reintente indefinidamente
    // Los errores se manejan internamente y se registran para revisión
  }

  return json({ received: true });
};
