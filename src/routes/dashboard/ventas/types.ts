export interface Cliente {
  id: number;
  razonSocial: string;
  rfc: string;
}

export interface Venta {
  id: number;
  numero_venta: string;
  clienteId: number;
  cliente: Cliente;
  montoTotal: number;
  fechaEmision: string;
  fechaVencimiento: string;
  estado_venta_id: number;
  createdAt: string;
  identificador?: string;
  Timbrado?: boolean;
  saldoPendiente?: number;
}

export interface Paginacion {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface EstadoVenta {
  id: number;
  codigo: string;
  nombre: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: Paginacion;
}
