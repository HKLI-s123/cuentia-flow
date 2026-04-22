import 'dotenv/config';
import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { PLAN_LIMITS } from './planes';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  // Usar process.env directamente ya que tenemos 'dotenv/config' arriba
  const secretKey = process.env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('[Stripe] STRIPE_SECRET_KEY no configurada');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2026-03-25.dahlia'
    });
  }

  return stripeClient;
}

// Mapeo de planes a price IDs - usar process.env directamente
export const PLAN_PRICES: Record<string, string> = {
  basico: process.env.STRIPE_PRICE_BASICO || env.STRIPE_PRICE_BASICO || '',
  pro: process.env.STRIPE_PRICE_PRO || env.STRIPE_PRICE_PRO || '',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || env.STRIPE_PRICE_ENTERPRISE || '',
};

// Debug: Log para verificar que se cargan las variables
if (typeof window === 'undefined') {
  // Solo en servidor
  console.log('[Stripe Debug]', {
    basico: process.env.STRIPE_PRICE_BASICO ? '✓ process.env' : (env.STRIPE_PRICE_BASICO ? '✓ $env' : '✗ VACÍO'),
    pro: process.env.STRIPE_PRICE_PRO ? '✓ process.env' : (env.STRIPE_PRICE_PRO ? '✓ $env' : '✗ VACÍO'),
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE ? '✓ process.env' : (env.STRIPE_PRICE_ENTERPRISE ? '✓ $env' : '✗ VACÍO'),
  });
}

// Mapeo inverso: price ID → nombre del plan
export function getPlanFromPriceId(priceId: string): string {
  for (const [plan, id] of Object.entries(PLAN_PRICES)) {
    if (id === priceId) return plan;
  }
  return 'free';
}
