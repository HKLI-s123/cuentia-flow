// Utilidades para el módulo Por Cobrar
import type {
  Factura,
  AgingCartera,
  MetricasPorCobrar,
  EstadoFactura,
  PrioridadCobranza
} from './types';

// Formatear moneda mexicana
export function formatearMoneda(monto: number | string | undefined): string {
  // Si es undefined o null, retornar 0
  if (monto === undefined || monto === null) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(0);
  }

  const numero = typeof monto === 'string' ? parseFloat(monto) : monto;

  // Verificar que sea un número válido
  if (isNaN(numero)) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(0);
  }

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(numero);
}

// Formatear fecha corta
export function formatearFecha(fecha: string | Date): string {
  let date: Date;

  if (typeof fecha === 'string') {
    // Extraer solo la parte de fecha (YYYY-MM-DD) para evitar problemas de zona horaria
    const fechaSolo = fecha.split('T')[0].split(' ')[0];
    const [year, month, day] = fechaSolo.split('-').map(Number);
    // Crear fecha en zona horaria local (no UTC)
    date = new Date(year, month - 1, day);
  } else {
    date = fecha;
  }

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// Formatear fecha con hora
export function formatearFechaHora(fecha: string | Date): string {
  let date: Date;

  if (typeof fecha === 'string') {
    // Extraer fecha y hora para evitar problemas de zona horaria
    const partes = fecha.split(' ');
    const fechaSolo = partes[0].split('T')[0];
    const [year, month, day] = fechaSolo.split('-').map(Number);

    // Si tiene hora, parsearla
    if (partes.length > 1 && partes[1]) {
      const horaParte = partes[1].split(':');
      const hours = parseInt(horaParte[0] || '0');
      const minutes = parseInt(horaParte[1] || '0');
      const seconds = parseInt(horaParte[2] || '0');
      date = new Date(year, month - 1, day, hours, minutes, seconds);
    } else {
      date = new Date(year, month - 1, day);
    }
  } else {
    date = fecha;
  }

  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Calcular días vencidos
export function calcularDiasVencidos(fechaVencimiento: string | Date): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0); // Normalizar a medianoche

  let vencimiento: Date;
  if (typeof fechaVencimiento === 'string') {
    const fechaSolo = fechaVencimiento.split('T')[0].split(' ')[0];
    const [year, month, day] = fechaSolo.split('-').map(Number);
    vencimiento = new Date(year, month - 1, day);
  } else {
    vencimiento = new Date(fechaVencimiento);
    vencimiento.setHours(0, 0, 0, 0);
  }

  const diffTime = hoy.getTime() - vencimiento.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

// Calcular días hasta vencimiento
export function calcularDiasHastaVencimiento(fechaVencimiento: string | Date): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0); // Normalizar a medianoche

  let vencimiento: Date;
  if (typeof fechaVencimiento === 'string') {
    const fechaSolo = fechaVencimiento.split('T')[0].split(' ')[0];
    const [year, month, day] = fechaSolo.split('-').map(Number);
    vencimiento = new Date(year, month - 1, day);
  } else {
    vencimiento = new Date(fechaVencimiento);
    vencimiento.setHours(0, 0, 0, 0);
  }

  const diffTime = vencimiento.getTime() - hoy.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

// Obtener clase CSS para badge de estado
export function getEstadoBadgeClass(estado: string): string {
  const clases: Record<string, string> = {
    'pendiente': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'parcial': 'bg-blue-100 text-blue-800 border-blue-200',
    'pagada': 'bg-green-100 text-green-800 border-green-200',
    'vencida': 'bg-red-100 text-red-800 border-red-200',
    'incobrable': 'bg-gray-100 text-gray-800 border-gray-200',
    'cancelada': 'bg-gray-100 text-gray-600 border-gray-300'
  };

  return clases[estado.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200';
}

// Obtener clase CSS para badge de prioridad
export function getPrioridadBadgeClass(prioridad: string): string {
  const clases: Record<string, string> = {
    'alta': 'bg-red-100 text-red-800 border-red-200',
    'media': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'baja': 'bg-green-100 text-green-800 border-green-200'
  };

  return clases[prioridad.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200';
}

// Obtener icono para tipo de gestión
export function getTipoGestionIcon(tipo: string): string {
  const iconos: Record<string, string> = {
    'llamada': '📞',
    'email': '📧',
    'whatsapp': '📱',
    'visita': '🏢',
    'carta': '📄'
  };

  return iconos[tipo.toLowerCase()] || '📝';
}

// Calcular aging de cartera
export function calcularAging(facturas: Factura[]): AgingCartera {
  const aging: AgingCartera = {
    actual: { cantidad: 0, monto: 0 },
    dias30: { cantidad: 0, monto: 0 },
    dias60: { cantidad: 0, monto: 0 },
    dias90: { cantidad: 0, monto: 0 },
    mas90: { cantidad: 0, monto: 0 }
  };

  facturas.forEach(factura => {
    const saldo = factura.saldoPendiente || 0;
    const dias = factura.diasVencido || 0;

    if (dias === 0) {
      aging.actual.cantidad++;
      aging.actual.monto += saldo;
    } else if (dias <= 30) {
      aging.dias30.cantidad++;
      aging.dias30.monto += saldo;
    } else if (dias <= 60) {
      aging.dias60.cantidad++;
      aging.dias60.monto += saldo;
    } else if (dias <= 90) {
      aging.dias90.cantidad++;
      aging.dias90.monto += saldo;
    } else {
      aging.mas90.cantidad++;
      aging.mas90.monto += saldo;
    }
  });

  return aging;
}

// Calcular métricas generales
export function calcularMetricas(facturas: Factura[]): MetricasPorCobrar {
  const facturasPendientes = facturas.filter(f =>
    f.saldoPendiente && f.saldoPendiente > 0
  );

  const facturasVencidas = facturas.filter(f =>
    (f.diasVencido || 0) > 0 && (f.saldoPendiente || 0) > 0
  );

  const facturasPagadas = facturas.filter(f =>
    (f.saldoPendiente || 0) === 0
  );

  const totalPorCobrar = facturasPendientes.reduce(
    (sum, f) => sum + (f.saldoPendiente || 0), 0
  );

  const montoVencido = facturasVencidas.reduce(
    (sum, f) => sum + (f.saldoPendiente || 0), 0
  );

  // Calcular promedio de días de cobranza
  const diasCobranza = facturas.map(f => f.diasVencido || 0);
  const promedioCobranza = diasCobranza.length > 0
    ? diasCobranza.reduce((a, b) => a + b, 0) / diasCobranza.length
    : 0;

  // Contar clientes únicos con saldo
  const clientesConSaldo = new Set(
    facturasPendientes.map(f => f.clienteId)
  ).size;

  return {
    totalPorCobrar,
    totalFacturas: facturas.length,
    facturasPendientes: facturasPendientes.length,
    facturasVencidas: facturasVencidas.length,
    facturasPagadas: facturasPagadas.length,
    promedioCobranza: Math.round(promedioCobranza * 10) / 10,
    montoVencido,
    clientesConSaldo
  };
}

// Validar datos de pago
export function validarDatosPago(datos: any): { valido: boolean; errores: string[] } {
  const errores: string[] = [];

  if (!datos.monto || datos.monto <= 0) {
    errores.push('El monto debe ser mayor a 0');
  }

  if (!datos.fechaPago) {
    errores.push('La fecha de pago es requerida');
  }

  if (!datos.metodo || datos.metodo.trim() === '') {
    errores.push('El método de pago es requerido');
  }

  // Validar que la fecha no sea futura
  if (datos.fechaPago) {
    const fechaSolo = datos.fechaPago.split('T')[0].split(' ')[0];
    const [year, month, day] = fechaSolo.split('-').map(Number);
    const fechaPago = new Date(year, month - 1, day);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (fechaPago > hoy) {
      errores.push('La fecha de pago no puede ser futura');
    }
  }

  return {
    valido: errores.length === 0,
    errores
  };
}

// Validar datos de gestión
export function validarDatosGestion(datos: any): { valido: boolean; errores: string[] } {
  const errores: string[] = [];

  if (!datos.tipoGestion || datos.tipoGestion.trim() === '') {
    errores.push('El tipo de gestión es requerido');
  }

  if (!datos.fechaGestion) {
    errores.push('La fecha de gestión es requerida');
  }

  if (!datos.descripcion || datos.descripcion.trim() === '') {
    errores.push('La descripción de la gestión es requerida');
  }

  // Si hay promesa de pago, validar datos
  if (datos.promesaPagoMonto && (!datos.promesaPagoFecha || datos.promesaPagoMonto <= 0)) {
    errores.push('Si especifica monto de promesa, debe incluir fecha y monto válido');
  }

  // Validar que la fecha no sea futura
  if (datos.fechaGestion) {
    const fechaSolo = datos.fechaGestion.split('T')[0].split(' ')[0];
    const [year, month, day] = fechaSolo.split('-').map(Number);
    const fechaGestion = new Date(year, month - 1, day);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (fechaGestion > hoy) {
      errores.push('La fecha de gestión no puede ser futura');
    }
  }

  return {
    valido: errores.length === 0,
    errores
  };
}

// Filtrar facturas según criterios
export function filtrarFacturas(facturas: Factura[], filtros: any): Factura[] {
  return facturas.filter(factura => {
    // Filtro por texto (número de factura o cliente)
    if (filtros.texto) {
      const texto = filtros.texto.toLowerCase();
      const numeroFactura = (factura.numero_factura || '').toLowerCase();
      const cliente = (factura.cliente?.razonSocial || '').toLowerCase();

      if (!numeroFactura.includes(texto) && !cliente.includes(texto)) {
        return false;
      }
    }

    // Filtro por estado
    if (filtros.estado && factura.estado_factura_id !== parseInt(filtros.estado)) {
      return false;
    }

    // Filtro por prioridad
    if (filtros.prioridad && factura.prioridad_cobranza_id !== parseInt(filtros.prioridad)) {
      return false;
    }

    // Filtro por días vencidos
    if (filtros.diasVencidoMinimo && (factura.diasVencido || 0) < filtros.diasVencidoMinimo) {
      return false;
    }

    if (filtros.diasVencidoMaximo && (factura.diasVencido || 0) > filtros.diasVencidoMaximo) {
      return false;
    }

    // Filtro por saldo pendiente
    if (filtros.saldoMinimo && (factura.saldoPendiente || 0) < filtros.saldoMinimo) {
      return false;
    }

    if (filtros.saldoMaximo && (factura.saldoPendiente || 0) > filtros.saldoMaximo) {
      return false;
    }

    return true;
  });
}

// Ordenar facturas
export function ordenarFacturas(facturas: Factura[], campo: string, direccion: 'asc' | 'desc' = 'desc'): Factura[] {
  return [...facturas].sort((a, b) => {
    let valorA: any;
    let valorB: any;

    switch (campo) {
      case 'numero_factura':
        valorA = a.numero_factura || '';
        valorB = b.numero_factura || '';
        break;
      case 'cliente':
        valorA = a.cliente?.razonSocial || '';
        valorB = b.cliente?.razonSocial || '';
        break;
      case 'montoTotal':
        valorA = a.montoTotal || 0;
        valorB = b.montoTotal || 0;
        break;
      case 'saldoPendiente':
        valorA = a.saldoPendiente || 0;
        valorB = b.saldoPendiente || 0;
        break;
      case 'fechaVencimiento':
        // Parsear fechas correctamente
        if (typeof a.fechaVencimiento === 'string') {
          const fechaSolo = a.fechaVencimiento.split('T')[0].split(' ')[0];
          const [year, month, day] = fechaSolo.split('-').map(Number);
          valorA = new Date(year, month - 1, day);
        } else {
          valorA = a.fechaVencimiento;
        }
        if (typeof b.fechaVencimiento === 'string') {
          const fechaSolo = b.fechaVencimiento.split('T')[0].split(' ')[0];
          const [year, month, day] = fechaSolo.split('-').map(Number);
          valorB = new Date(year, month - 1, day);
        } else {
          valorB = b.fechaVencimiento;
        }
        break;
      case 'diasVencido':
        valorA = a.diasVencido || 0;
        valorB = b.diasVencido || 0;
        break;
      default:
        return 0;
    }

    if (valorA < valorB) {
      return direccion === 'asc' ? -1 : 1;
    }
    if (valorA > valorB) {
      return direccion === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

// Generar colores para gráficos
export function generarColoresAging(): string[] {
  return [
    '#22c55e', // Verde - Actual
    '#eab308', // Amarillo - 1-30 días
    '#f97316', // Naranja - 31-60 días
    '#ef4444', // Rojo - 61-90 días
    '#7c2d12'  // Rojo oscuro - 90+ días
  ];
}

// Obtener prioridad por días vencidos (regla de negocio)
export function obtenerPrioridadPorDias(diasVencido: number): 'baja' | 'media' | 'alta' {
  if (diasVencido >= 90) return 'alta';
  if (diasVencido >= 30) return 'media';
  return 'baja';
}

// Formatear número con separadores de miles
export function formatearNumero(numero: number | string): string {
  const num = typeof numero === 'string' ? parseFloat(numero) : numero;

  if (isNaN(num)) {
    return '0';
  }

  return new Intl.NumberFormat('es-MX').format(num);
}

// Calcular porcentaje
export function calcularPorcentaje(valor: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((valor / total) * 100 * 10) / 10;
}

// Obtener mensaje de estado de factura
export function getMensajeEstado(factura: Factura): string {
  const dias = factura.diasVencido || 0;
  const saldo = factura.saldoPendiente || 0;

  if (saldo === 0) return 'Pagada completamente';
  if (dias === 0) return 'Al corriente';
  if (dias <= 30) return `Vencida ${dias} días`;
  if (dias <= 60) return `Vencida ${dias} días - Requiere seguimiento`;
  if (dias <= 90) return `Vencida ${dias} días - Atención prioritaria`;
  return `Vencida ${dias} días - CRÍTICA`;
}

// Validar email
export function validarEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Validar teléfono mexicano
export function validarTelefono(telefono: string): boolean {
  const regex = /^(\+52|52)?\s?[0-9]{10}$/;
  return regex.test(telefono.replace(/[\s\-\(\)]/g, ''));
}

// Obtener siguiente fecha de gestión sugerida
export function obtenerFechaProximaGestion(resultado: string): Date | null {
  const hoy = new Date();

  switch (resultado) {
    case 'no_contesta':
      // Intentar nuevamente en 3 días
      return new Date(hoy.getTime() + (3 * 24 * 60 * 60 * 1000));
    case 'promesa_pago':
      // Seguimiento en 7 días
      return new Date(hoy.getTime() + (7 * 24 * 60 * 60 * 1000));
    case 'contactado':
      // Seguimiento en 15 días
      return new Date(hoy.getTime() + (15 * 24 * 60 * 60 * 1000));
    case 'no_localizado':
      // Intentar por otro medio en 5 días
      return new Date(hoy.getTime() + (5 * 24 * 60 * 60 * 1000));
    default:
      return null;
  }
}