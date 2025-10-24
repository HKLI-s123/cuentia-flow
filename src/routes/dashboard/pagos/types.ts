export interface Usuario {
  id: number;
  nombre?: string;
  apellido?: string;
  correo?: string;
}

export interface Cliente {
  id: number;
  razonSocial: string;
  rfc?: string;
  correo?: string;
  telefono?: string;
}

export interface Factura {
  id: number;
  numero_factura: string;
  cliente?: Cliente;
  montoTotal?: number;
  saldoPendiente?: number;
  fechaEmision?: string;
  fechaVencimiento?: string;
}

export interface Pago {
  id: number;
  facturaId: number;
  usuarioId: number;
  monto: number;
  fechaPago: string;
  metodo: string; // 'efectivo', 'transferencia', 'cheque', 'tarjeta', etc.
  createdAt: string;
  updatedAt: string;
  // Campos relacionados (del JOIN con facturas y usuarios)
  factura?: Factura;
  usuario?: Usuario;
  // Campos calculados para UI
  estado_pago_id?: number; // 1=Pendiente, 2=Aplicado, 3=Rechazado (calculado)
}

export interface PagoResponse {
  success: boolean;
  pagos: Pago[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  conteoEstados?: Record<number, number>;
}

export interface Paginacion {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const METODOS_PAGO = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'transferencia', nombre: 'Transferencia Bancaria' },
  { id: 'cheque', nombre: 'Cheque' },
  { id: 'tarjeta', nombre: 'Tarjeta de Crédito' },
  { id: 'otro', nombre: 'Otro' }
] as const;
