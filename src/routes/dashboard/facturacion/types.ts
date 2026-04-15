// Estados de factura (catálogo dinámico)
export interface EstadoFactura {
  id: number;
  codigo: string;
  nombre?: string;
  descripcion?: string;
  color?: string;
}

// Prioridades de cobranza (catálogo dinámico)
export interface PrioridadCobranza {
  id: number;
  codigo: string;
  nombre?: string;
  descripcion?: string;
  color?: string;
}

// Información básica del cliente para facturas
export interface ClienteFactura {
  id: number;
  nombreComercial?: string;
  razonSocial: string;
  rfc: string;
  correo?: string;
  telefono?: string;
  telefonoWhatsApp?: string;
  codigoPais?: string;
  codigoPostal?: string;
  regimenFiscal?: string;
}

// Impuesto de un concepto
export interface ImpuestoConcepto {
  tipo: string;
  tasa: number;
  monto: number;
}

// Concepto/producto de una factura
export interface ConceptoFactura {
  id?: number;
  nombre: string;
  descripcion?: string;
  claveProdServ?: string;
  unidadMedida?: string;
  cantidad?: number;
  precioUnitario?: number;
  subtotal?: number;
  monedaProducto?: string;
  objetoImpuesto?: string;
  totalImpuestos?: number;
  total?: number;
  impuestos?: ImpuestoConcepto[];
}

// Pago con datos de complemento (para documentos con relación)
export interface PagoComplemento {
  id: number;
  monto: number;
  fechaPago: string;
  metodo: string;
  facturapiPagoId?: string | null;
  uuidPago?: string | null;
}

// Factura completa
export interface Factura {
  id: number;
  numero_factura?: string;
  clienteId: number;
  cliente?: ClienteFactura;
  montoTotal?: number;
  saldoPendiente?: number;
  fechaEmision: string;
  fechaVencimiento: string;
  diasVencido?: number;
  ultimaGestion?: string;
  observaciones?: string;
  estado_factura_id?: number;
  prioridad_cobranza_id?: number;
  estadoFactura?: EstadoFactura;
  prioridadCobranza?: PrioridadCobranza;
  metodoPago?: string;
  formaPago?: string;
  usuarioCreadorId?: number;
  usuarioCreadorCorreo?: string;
  usuarioCreadorNombre?: string;
  usuarioCreadorApellido?: string;
  conceptos?: ConceptoFactura[];
  uuid?: string;
  timbrado?: boolean;
  condicionesPago?: string;
  agenteIAActivo?: boolean;
  notasCliente?: string | null;
  notasInternas?: string | null;
  ordenCompra?: string | null;
  identificador?: string | null;
  pagos?: PagoComplemento[];
  createdAt: string;
  recurrenciaActiva?: boolean;
  facturaOrigenId?: number | null;
  facturasGeneradas?: number;
  recurrencia?: {
    activa: boolean;
    periodo: string | null;
    dia: number | null;
    finRecurrencia: string | null;
    numeroOcurrencias: number | null;
    fechaFinRecurrencia: string | null;
    facturasGeneradas: number;
    ultimaFacturaGenerada: string | null;
    orden: string | null;
    identificador: string | null;
  };
  templateOrigenNumero?: string | null;
  facturasHijas?: {
    id: number;
    numeroFactura: string;
    montoTotal: number;
    fechaEmision: string;
    fechaTimbrado: string | null;
    uuid: string | null;
    timbrado: boolean;
    estadoCodigo: string;
  }[];
}

// Pago aplicado a factura
export interface Pago {
  id: number;
  facturaId: number;
  usuarioId: number;
  monto: number;
  fechaPago: string;
  metodo: string;
  referencia?: string;
  notas?: string;
  factura?: Factura;
  createdAt: string;
}

// Gestión de cobranza
export interface GestionCobranza {
  id: number;
  facturaId: number;
  usuarioId: number;
  tipoGestion?: string; // 'llamada', 'email', 'whatsapp', 'visita'
  resultado?: string; // 'contactado', 'no_contesta', 'promesa_pago', 'pago_parcial'
  descripcion?: string;
  fechaGestion: string;
  fechaProximaGestion?: string;
  promesaPagoFecha?: string;
  promesaPagoMonto?: number;
  requiereSeguimiento?: boolean;
  factura?: Factura;
}

// Filtros para búsqueda de facturas
export interface FiltrosFactura {
  texto?: string;
  clienteId?: number;
  estado_factura_id?: number;
  prioridad_cobranza_id?: number;
  fechaEmisionDesde?: string;
  fechaEmisionHasta?: string;
  fechaVencimientoDesde?: string;
  fechaVencimientoHasta?: string;
  montoMinimo?: number;
  montoMaximo?: number;
  saldoMinimo?: number;
  saldoMaximo?: number;
  diasVencidoMinimo?: number;
  diasVencidoMaximo?: number;
  conSaldoPendiente?: boolean;
  requiereGestion?: boolean;
}

// Métricas del dashboard
export interface MetricasPorCobrar {
  totalPorCobrar: number;
  totalFacturas: number;
  facturasPendientes: number;
  facturasVencidas: number;
  facturasPagadas: number;
  promedioCobranza: number;
  montoVencido: number;
  clientesConSaldo: number;
}

// Aging de cartera
export interface AgingCartera {
  actual: {
    cantidad: number;
    monto: number;
  };
  dias30: {
    cantidad: number;
    monto: number;
  };
  dias60: {
    cantidad: number;
    monto: number;
  };
  dias90: {
    cantidad: number;
    monto: number;
  };
  mas90: {
    cantidad: number;
    monto: number;
  };
}

// Recordatorio programado
export interface RecordatorioProgramado {
  id: number;
  clienteId: number;
  facturaId?: number;
  tipoRecordatorio?: string; // 'vencimiento', 'seguimiento', 'promesa_pago'
  fechaEnvio: string;
  mensaje?: string;
  estado?: string; // 'pendiente', 'enviado', 'fallido'
  canalEnvio?: string; // 'email', 'whatsapp', 'sms'
}

// Respuesta API para lista de facturas
export interface RespuestaFacturas {
  facturas: Factura[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

// Respuesta API para métricas
export interface RespuestaMetricas {
  metricas: MetricasPorCobrar;
  aging: AgingCartera;
  tendencias?: {
    semanaAnterior: number;
    mesAnterior: number;
    cambioSemanal: number;
    cambioMensual: number;
  };
}

// Datos para crear/editar pago
export interface DatosPago {
  facturaId: number;
  monto: number;
  fechaPago: string;
  metodo: string;
  referencia?: string;
  notas?: string;
}

// Datos para crear/editar gestión
export interface DatosGestion {
  facturaId: number;
  tipoGestion: string;
  resultado?: string;
  descripcion?: string;
  fechaGestion: string;
  fechaProximaGestion?: string;
  promesaPagoFecha?: string;
  promesaPagoMonto?: number;
  requiereSeguimiento?: boolean;
}

// Configuración de cobranza
export interface ConfiguracionCobranza {
  id: number;
  organizacionId: number;
  diasGracia?: number;
  escalonamiento?: string; // JSON con configuración de escalamiento
  envioAutomaticoRecordatorios?: boolean;
  diasRecordatorioPrevio?: number;
  plantillasEmail?: any; // JSON con plantillas
  configuracionWhatsApp?: any; // JSON con configuración
}

// Estados del modal
export interface EstadoModal {
  tipo?: 'pago' | 'gestion' | 'detalle' | null;
  abierto: boolean;
  factura?: Factura | null;
  cargando?: boolean;
  error?: string | null;
}

// Opciones para selectores
export interface OpcionSelect {
  value: string | number;
  label: string;
  disabled?: boolean;
}

// Tipos de gestión predefinidos
export const TIPOS_GESTION = [
  { value: 'llamada', label: 'Llamada Telefónica' },
  { value: 'email', label: 'Correo Electrónico' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'visita', label: 'Visita Presencial' },
  { value: 'carta', label: 'Carta/Documento' }
] as const;

// Resultados de gestión predefinidos
export const RESULTADOS_GESTION = [
  { value: 'contactado', label: 'Contactado - Sin Compromiso' },
  { value: 'no_contesta', label: 'No Contesta' },
  { value: 'promesa_pago', label: 'Promesa de Pago' },
  { value: 'pago_parcial', label: 'Pago Parcial Recibido' },
  { value: 'pago_total', label: 'Pago Total Recibido' },
  { value: 'disputa', label: 'Disputa/Reclamo' },
  { value: 'acuerdo_pago', label: 'Acuerdo de Pago' },
  { value: 'no_localizado', label: 'Cliente No Localizado' }
] as const;

// Métodos de pago predefinidos
export const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia Bancaria' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'tarjeta_credito', label: 'Tarjeta de Crédito' },
  { value: 'tarjeta_debito', label: 'Tarjeta de Débito' },
  { value: 'deposito', label: 'Depósito Bancario' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'otros', label: 'Otros' }
] as const;