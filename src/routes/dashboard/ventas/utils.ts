export function formatearMoneda(monto: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(monto);
}

export function formatearFecha(fecha: string): string {
  if (!fecha) return 'N/A';
  try {
    const date = new Date(fecha.split('T')[0]);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return 'N/A';
  }
}

export function getEstadoBadgeClass(estado: string): string {
  const clases: Record<string, string> = {
    pagada: 'bg-green-100 text-green-700',
    pendiente: 'bg-yellow-100 text-yellow-700',
    vencida: 'bg-red-100 text-red-700',
    cancelada: 'bg-gray-100 text-gray-700',
    vigente: 'bg-blue-100 text-blue-700',
    parcial: 'bg-orange-100 text-orange-700'
  };
  return clases[estado] || clases.vigente;
}

export function filtrarVentas(
  ventas: any[],
  filtroTexto: string,
  filtroEstado: string
): any[] {
  return ventas.filter(venta => {
    const coincideTexto =
      !filtroTexto ||
      venta.numero_venta?.toString().includes(filtroTexto) ||
      venta.cliente?.razonSocial?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
      venta.identificador?.toLowerCase().includes(filtroTexto.toLowerCase());

    const coincideEstado = !filtroEstado || venta.estado_venta_id?.toString() === filtroEstado;

    return coincideTexto && coincideEstado;
  });
}

export function calcularMetricas(ventas: any[]) {
  return {
    totalVentas: ventas.length,
    montoTotal: ventas.reduce((sum, v) => sum + (v.montoTotal || 0), 0),
    promedioPorVenta: ventas.length > 0
      ? ventas.reduce((sum, v) => sum + (v.montoTotal || 0), 0) / ventas.length
      : 0
  };
}
