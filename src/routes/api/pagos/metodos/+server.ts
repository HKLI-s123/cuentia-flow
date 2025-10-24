import type { RequestHandler } from '@sveltejs/kit';

/**
 * Catálogo oficial de métodos de pago SAT
 * https://www.sat.gob.mx/
 */
const METODOS_PAGO_SAT = [
  { id: '01', codigo: '01', nombre: 'Efectivo', descripcion: 'Pago en efectivo' },
  { id: '02', codigo: '02', nombre: 'Cheque nominativo', descripcion: 'Cheque a nombre del beneficiario' },
  { id: '03', codigo: '03', nombre: 'Transferencia electrónica de fondos', descripcion: 'Transferencia bancaria' },
  { id: '04', codigo: '04', nombre: 'Tarjeta de crédito', descripcion: 'Pago con tarjeta de crédito' },
  { id: '05', codigo: '05', nombre: 'Monedero electrónico', descripcion: 'Billetera digital' },
  { id: '06', codigo: '06', nombre: 'Dinero electrónico', descripcion: 'Transferencia de dinero electrónico' },
  { id: '07', codigo: '07', nombre: 'Vales de despensa', descripcion: 'Vales de despensa' },
  { id: '08', codigo: '08', nombre: 'Servicios de pago electrónico de comerciantes', descripcion: 'Servicios de pago en línea' },
  { id: '09', codigo: '09', nombre: 'Tarjeta de débito', descripcion: 'Pago con tarjeta de débito' },
  { id: '10', codigo: '10', nombre: 'Dinero en depósito', descripcion: 'Dinero depositado en cuenta' },
  { id: '11', codigo: '11', nombre: 'Intermediarios pagadores', descripcion: 'Pago a través de intermediarios' },
  { id: '12', codigo: '12', nombre: 'Aclaraciones o devoluciones de pagos', descripcion: 'Aclaraciones o devoluciones' },
  { id: '13', codigo: '13', nombre: 'Subasta o compraventa de bienes o servicios públicos', descripcion: 'Compraventa en subasta' },
  { id: '14', codigo: '14', nombre: 'Dación en pago', descripcion: 'Pago en especie' },
  { id: '15', codigo: '15', nombre: 'Pago por terceros', descripcion: 'Pago realizado por un tercero' },
  { id: '16', codigo: '16', nombre: 'Condona o condonación', descripcion: 'Condonación de deuda' },
  { id: '17', codigo: '17', nombre: 'Compensación', descripcion: 'Compensación entre deudas' },
  { id: '18', codigo: '18', nombre: 'Novación', descripcion: 'Novación de obligación' },
  { id: '19', codigo: '19', nombre: 'Confusión', descripcion: 'Confusión de obligación' },
  { id: '20', codigo: '20', nombre: 'Remisión de deuda', descripcion: 'Remisión total o parcial' },
  { id: '21', codigo: '21', nombre: 'Prescripción o caducidad', descripcion: 'Prescripción de deuda' },
  { id: '22', codigo: '22', nombre: 'A plazos', descripcion: 'Pago a plazos' },
  { id: '23', codigo: '23', nombre: 'Pago por garantía o afianzamiento', descripcion: 'Pago garantizado' },
  { id: '24', codigo: '24', nombre: 'Transferencia de deuda', descripcion: 'Transferencia de obligación' },
  { id: '25', codigo: '25', nombre: 'Asunción de deuda', descripcion: 'Asunción de obligación' },
  { id: '26', codigo: '26', nombre: 'Conversión de deuda', descripcion: 'Conversión a otra obligación' },
  { id: '27', codigo: '27', nombre: 'Pago con bienes o servicios', descripcion: 'Pago en especie o servicios' },
  { id: '28', codigo: '28', nombre: 'Pago por subrogación', descripcion: 'Pago por sustitución' },
  { id: '29', codigo: '29', nombre: 'Otros', descripcion: 'Otros métodos de pago no listados' },
  { id: '30', codigo: '30', nombre: 'Crédito simple', descripcion: 'Acuerdo de crédito' },
  { id: '31', codigo: '31', nombre: 'Crédito en cuenta corriente', descripcion: 'Cuenta corriente' },
  { id: '32', codigo: '32', nombre: 'Garantía de fondos de terceros', descripcion: 'Garantía de terceros' },
  { id: '33', codigo: '33', nombre: 'Depósito en garantía', descripcion: 'Depósito garantía' },
  { id: '34', codigo: '34', nombre: 'Crédito documentario colectivo', descripcion: 'Crédito colectivo' },
  { id: '35', codigo: '35', nombre: 'Crédito con garantía hipotecaria', descripcion: 'Crédito hipotecario' },
  { id: '36', codigo: '36', nombre: 'Pago por cuenta de terceros', descripcion: 'Pago en nombre de terceros' },
];

export const GET: RequestHandler = async ({ url }) => {
  try {
    const organizacionId = url.searchParams.get('organizacionId');

    if (!organizacionId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'organizacionId es requerido'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        metodos: METODOS_PAGO_SAT
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching metodos pago:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Error al obtener métodos de pago'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
