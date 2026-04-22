import { getConnection } from './db';
import { PLAN_LIMITS } from './planes';

/**
 * Obtiene el plan actual de una organización desde la tabla Suscripciones
 */
export async function obtenerPlanOrganizacion(organizacionId: number): Promise<string> {
  try {
    const pool = await getConnection();
    const result = await pool.query(
      'SELECT planseleccionado, estado FROM suscripciones WHERE organizacionid = $1',
      [organizacionId]
    );

    if (result.rows.length === 0) return 'free';

    const sub = result.rows[0];
    if (sub.estado === 'canceled' || sub.estado === 'unpaid') return 'free';

    return sub.planseleccionado || 'free';
  } catch {
    return 'free';
  }
}

/**
 * Obtiene los límites del plan actual de una organización
 */
export async function obtenerLimitesPlan(organizacionId: number) {
  const plan = await obtenerPlanOrganizacion(organizacionId);
  return {
    plan,
    limites: PLAN_LIMITS[plan] || PLAN_LIMITS['free'],
  };
}

/**
 * Valida si la organización puede crear más facturas este mes
 */
export async function validarLimiteFacturas(organizacionId: number): Promise<{
  permitido: boolean;
  facturas_mes: number;
  facturas_max: number;
  plan: string;
  mensaje: string;
}> {
  const { plan, limites } = await obtenerLimitesPlan(organizacionId);

  const pool = await getConnection();
  const result = await pool.query(
    `SELECT COUNT(*) as total
     FROM facturas f
     INNER JOIN clientes c ON f.clienteid = c.id
     WHERE c.organizacionid = $1
       AND EXTRACT(MONTH FROM f.fechaemision) = EXTRACT(MONTH FROM NOW())
       AND EXTRACT(YEAR FROM f.fechaemision) = EXTRACT(YEAR FROM NOW())`,
    [organizacionId]
  );

  const facturasMes = parseInt(result.rows[0]?.total, 10) || 0;

  if (facturasMes >= limites.maxFacturasMes) {
    return {
      permitido: false,
      facturas_mes: facturasMes,
      facturas_max: limites.maxFacturasMes,
      plan,
      mensaje: `Has alcanzado el límite de ${limites.maxFacturasMes} facturas/mes en tu plan ${plan}. Actualiza tu plan para crear más facturas.`,
    };
  }

  return {
    permitido: true,
    facturas_mes: facturasMes,
    facturas_max: limites.maxFacturasMes,
    plan,
    mensaje: 'OK',
  };
}

/**
 * Valida si la organización tiene acceso a una función específica del plan
 */
export async function validarAccesoFuncion(
  organizacionId: number,
  funcion: 'whatsapp' | 'agenteIA' | 'complementoAutomatico' | 'email' | 'api' | 'recurrencia'
): Promise<{
  permitido: boolean;
  plan: string;
  mensaje: string;
}> {
  const { plan, limites } = await obtenerLimitesPlan(organizacionId);

  if (!limites[funcion]) {
    const nombres: Record<string, string> = {
      whatsapp: 'WhatsApp',
      agenteIA: 'Cobrador IA',
      complementoAutomatico: 'Complemento automático',
      email: 'Envío de correos',
      api: 'Acceso API',
      recurrencia: 'Facturación recurrente',
    };
    return {
      permitido: false,
      plan,
      mensaje: `${nombres[funcion]} no está disponible en tu plan ${plan}. Actualiza tu plan para acceder a esta función.`,
    };
  }

  return { permitido: true, plan, mensaje: 'OK' };
}

/**
 * Valida si la organización puede crear más clientes
 * (reemplaza la lógica antigua de validar-limites-clientes.ts)
 */
export async function validarLimiteClientes(organizacionId: number): Promise<{
  permitido: boolean;
  clientes_actual: number;
  clientes_max: number;
  plan: string;
  mensaje: string;
}> {
  const { plan, limites } = await obtenerLimitesPlan(organizacionId);

  const pool = await getConnection();
  const result = await pool.query(
    'SELECT COUNT(*) as total FROM clientes WHERE organizacionid = $1',
    [organizacionId]
  );

  const clientesActual = parseInt(result.rows[0]?.total, 10) || 0;

  if (clientesActual >= limites.maxClientes) {
    return {
      permitido: false,
      clientes_actual: clientesActual,
      clientes_max: limites.maxClientes,
      plan,
      mensaje: `Has alcanzado el límite de ${limites.maxClientes} clientes en tu plan ${plan}. Actualiza tu plan para agregar más clientes.`,
    };
  }

  return {
    permitido: true,
    clientes_actual: clientesActual,
    clientes_max: limites.maxClientes,
    plan,
    mensaje: 'OK',
  };
}
