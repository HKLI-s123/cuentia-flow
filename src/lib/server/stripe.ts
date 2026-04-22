import 'dotenv/config';
import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { PLAN_LIMITS } from './planes';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('[Stripe] STRIPE_SECRET_KEY no configurada');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-03-25.dahlia'
    });
  }

  return stripeClient;
}

// Mapeo de planes a price IDs
export const PLAN_PRICES: Record<string, string> = {
  basico: env.STRIPE_PRICE_BASICO || '',
  pro: env.STRIPE_PRICE_PRO || '',
  enterprise: env.STRIPE_PRICE_ENTERPRISE || '',
};

// Mapeo inverso: price ID → nombre del plan
export function getPlanFromPriceId(priceId: string): string {
  for (const [plan, id] of Object.entries(PLAN_PRICES)) {
    if (id === priceId) return plan;
  }
  return 'free';
}
