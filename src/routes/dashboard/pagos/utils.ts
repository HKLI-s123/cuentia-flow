import type { Pago } from './types';
import { METODOS_PAGO } from './types';

/**
 * Formatea un número como moneda mexicana
 */
export function formatearMoneda(monto: number | undefined | null): string {
  if (!monto && monto !== 0) return '$0.00';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(monto);
}

/**
 * Formatea una fecha en formato corto
 */
export function formatearFecha(fecha: string | Date | undefined | null): string {
  if (!fecha) return 'N/A';
  let date: Date;
  if (typeof fecha === 'string') {
    // Extraer YYYY-MM-DD y crear fecha local para evitar desfase de timezone
    const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    } else {
      date = new Date(fecha);
    }
  } else {
    date = fecha;
  }
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

/**
 * Obtiene el nombre del método de pago
 */
export function getMetodoNombre(metodoId: string): string {
  const metodo = METODOS_PAGO.find(m => m.id === metodoId);
  return metodo?.nombre || metodoId;
}

/**
 * Calcula métricas de pagos
 */
export function calcularMetricas(pagos: Pago[]) {
  const metricas = {
    totalPagos: pagos.length,
    montoTotal: 0,
    montoPromedio: 0,
    pagoMasReciente: null as string | null,
    pagoMasAntiguo: null as string | null
  };

  pagos.forEach(pago => {
    metricas.montoTotal += pago.monto || 0;
  });

  metricas.montoPromedio = metricas.totalPagos > 0 ? metricas.montoTotal / metricas.totalPagos : 0;

  // Encontrar pago más reciente
  if (pagos.length > 0) {
    const pagosOrdenados = [...pagos].sort((a, b) => {
      return new Date(b.fechaPago).getTime() - new Date(a.fechaPago).getTime();
    });
    metricas.pagoMasReciente = pagosOrdenados[0]?.fechaPago || null;
    metricas.pagoMasAntiguo = pagosOrdenados[pagosOrdenados.length - 1]?.fechaPago || null;
  }

  return metricas;
}

/**
 * Valida datos de pago antes de enviar
 */
export function validarPago(pago: Partial<Pago>): { valido: boolean; errores: string[] } {
  const errores: string[] = [];

  if (!pago.monto || pago.monto <= 0) {
    errores.push('El monto debe ser mayor a cero');
  }

  if (!pago.fechaPago) {
    errores.push('La fecha de pago es requerida');
  }

  if (!pago.metodo || pago.metodo.trim() === '') {
    errores.push('El método de pago es requerido');
  }

  if (!pago.facturaId) {
    errores.push('La factura es requerida');
  }

  return {
    valido: errores.length === 0,
    errores
  };
}
