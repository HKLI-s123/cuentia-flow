import Stripe from 'stripe';
import { env } from '$env/dynamic/private';

if (!env.STRIPE_SECRET_KEY) {
  console.warn('[Stripe] STRIPE_SECRET_KEY no configurada');
}

export const stripe = new Stripe(env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-03-25.dahlia',
});

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

// Límites por plan
export const PLAN_LIMITS: Record<string, {
  maxOrganizaciones: number;
  maxFacturasMes: number;
  maxClientes: number;
  whatsapp: boolean;
  agenteIA: boolean;
  complementoAutomatico: boolean;
  email: boolean;
  api: boolean;
  recurrencia: boolean;
}> = {
  free: {
    maxOrganizaciones: 1,
    maxFacturasMes: 3,
    maxClientes: 5,
    whatsapp: false,
    agenteIA: false,
    complementoAutomatico: false,
    email: false,
    api: false,
    recurrencia: false,
  },
  basico: {
    maxOrganizaciones: 1,
    maxFacturasMes: 50,
    maxClientes: 50,
    whatsapp: true,
    agenteIA: true,
    complementoAutomatico: true,
    email: true,
    api: false,
    recurrencia: true,
  },
  pro: {
    maxOrganizaciones: 3,
    maxFacturasMes: 200,
    maxClientes: 200,
    whatsapp: true,
    agenteIA: true,
    complementoAutomatico: true,
    email: true,
    api: false,
    recurrencia: true,
  },
  enterprise: {
    maxOrganizaciones: 999999,
    maxFacturasMes: 999999,
    maxClientes: 999999,
    whatsapp: true,
    agenteIA: true,
    complementoAutomatico: true,
    email: true,
    api: true,
    recurrencia: true,
  },
};
