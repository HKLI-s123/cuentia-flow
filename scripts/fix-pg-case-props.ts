/**
 * Script to fix TypeScript property accesses that reference database result
 * columns with mixed case, after renaming all DB columns to lowercase.
 * 
 * We need to fix patterns like:
 *   user.Id → user.id
 *   row.OrganizacionId → row.organizacionid  (but could also be row.OrganizacionId for API mappings)
 *   result.rows[0].Correo → result.rows[0].correo
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIRS = [
  path.join(__dirname, '..', 'src'),
  path.join(__dirname, '..', 'worker'),
];

const EXTENSIONS = ['.ts', '.svelte'];

function findFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  function walk(d: string) {
    if (!fs.existsSync(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.svelte-kit' || entry.name === 'build') continue;
        walk(fullPath);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  walk(dir);
  return results;
}

// Database column name mappings: MixedCase → lowercase
// These are used as property names on database result objects
const DB_PROPERTY_MAP: Record<string, string> = {
  // Primary
  'Id': 'id',
  
  // User columns
  'Correo': 'correo',
  'Contrasena': 'contrasena', 
  'NumeroTel': 'numerotel',
  'Activo': 'activo',
  'Nombre': 'nombre',
  'Apellido': 'apellido',
  'FechaCreacion': 'fechacreacion',
  
  // Organization / Relations
  'OrganizacionId': 'organizacionid',
  'UsuarioId': 'usuarioid',
  'ClienteId': 'clienteid',
  'FacturaId': 'facturaid',
  'RolId': 'rolid',
  'ConceptoId': 'conceptoid',
  'PagoId': 'pagoid',
  'SuscripcionId': 'suscripcionid',
  
  // Organization
  'RFC': 'rfc',
  'RazonSocial': 'razonsocial',
  'CorreoElectronico': 'correoelectronico',
  'IdFacturaAPI': 'idfacturaapi',
  'ApiKeyFacturaAPI': 'apikeyfacturaapi',
  'FechaActualizacionApiKey': 'fechaactualizacionapikey',
  
  // Client  
  'NombreComercial': 'nombrecomercial',
  'RegimenFiscal': 'regimenfiscal',
  'CondicionesPago': 'condicionespago',
  'CorreoPrincipal': 'correoprincipal',
  'Pais': 'pais',
  'CodigoPais': 'codigopais',
  'Telefono': 'telefono',
  'Estado': 'estado',
  'Calle': 'calle',
  'NumeroExterior': 'numeroexterior',
  'NumeroInterior': 'numerointerior',
  'CodigoPostal': 'codigopostal',
  'Colonia': 'colonia',
  'Ciudad': 'ciudad',
  'RegimenFiscalId': 'regimenfiscalid',
  'EstadoId': 'estadoid',
  'PaisId': 'paisid',
  'IdClienteFacturaAPI': 'idclientefacturaapi',
  'FechaRegistroFacturaAPI': 'fecharegistrofacturaapi',
  'SincronizadoFacturaAPI': 'sincronizadofacturaapi',
  'ErrorSincronizacionFacturaAPI': 'errorsincronizacionfacturaapi',
  'TelefonoWhatsApp': 'telefonowhatsapp',
  'AutoComplementoPago': 'autocomplementopago',
  
  // Invoice
  'MontoTotal': 'montototal',
  'FechaEmision': 'fechaemision',
  'FechaVencimiento': 'fechavencimiento',
  'SaldoPendiente': 'saldopendiente',
  'DiasVencido': 'diasvencido',
  'UltimaGestion': 'ultimagestion',
  'Observaciones': 'observaciones',
  'FechaUltimoPago': 'fechaultimopago',
  'RecurrenciaActiva': 'recurrenciaactiva',
  'OrdenRecurrencia': 'ordenrecurrencia',
  'IdentificadorRecurrencia': 'identificadorrecurrencia',
  'FechaInicioRecurrencia': 'fechainiciorecurrencia',
  'FechaPrimeraFactura': 'fechaprimerafactura',
  'PeriodoRecurrencia': 'periodorecurrencia',
  'DiaRecurrencia': 'diarecurrencia',
  'CadaRecurrencia': 'cadarecurrencia',
  'FinRecurrencia': 'finrecurrencia',
  'FechaFinRecurrencia': 'fechafinrecurrencia',
  'NumeroOcurrencias': 'numeroocurrencias',
  'OrdenCompra': 'ordencompra',
  'Moneda': 'moneda',
  'TipoCambio': 'tipocambio',
  'NotasCliente': 'notascliente',
  'NotasInternas': 'notasinternas',
  'UUIDFacturapi': 'uuidfacturapi',
  'PDFUrl': 'pdfurl',
  'XMLUrl': 'xmlurl',
  'DesglosarImpuestos': 'desglosarimpuestos',
  'Identificador': 'identificador',
  'MetodoPago': 'metodopago',
  'UsuarioCreadorId': 'usuariocreadorid',
  'FormaPago': 'formapago',
  'UUID': 'uuid',
  'Timbrado': 'timbrado',
  'FechaTimbrado': 'fechatimbrado',
  'FacturapiId': 'facturapiid',
  'UsoCFDI': 'usocfdi',
  'PDFBase64': 'pdfbase64',
  'XMLBase64': 'xmlbase64',
  'AgenteIAActivo': 'agenteiaactivo',
  'MotivoCancelacion': 'motivocancelacion',
  'MotivoCancelacionDescripcion': 'motivocancelaciondescripcion',
  'EstadoCancelacion': 'estadocancelacion',
  'FacturaSustitucionId': 'facturasustitucionid',
  'FechaCancelacion': 'fechacancelacion',
  'UltimaFacturaGenerada': 'ultimafacturagenerada',
  'FacturasGeneradas': 'facturasgeneradas',
  'EnviarPorCorreo': 'enviarporcorreo',
  'EnviarPorWhatsApp': 'enviarporwhatsapp',
  'FacturaOrigenId': 'facturaorigenid',
  
  // Payment
  'Monto': 'monto',
  'FechaPago': 'fechapago',
  'Metodo': 'metodo',
  'FacturapiPagoId': 'facturapipagoid',
  'UUIDPago': 'uuidpago',
  'Cancelado': 'cancelado',
  'ComprobanteBase64': 'comprobantebase64',
  'ComprobanteMimetype': 'comprobantemimetype',
  'TokenComprobante': 'tokencomprobante',
  'TokenExpiracion': 'tokenexpiracion',
  
  // Concept
  'Descripcion': 'descripcion',
  'ClaveProdServ': 'claveprodserv',
  'UnidadMedida': 'unidadmedida',
  'Cantidad': 'cantidad',
  'PrecioUnitario': 'preciounitario',
  'Subtotal': 'subtotal',
  'MonedaProducto': 'monedaproducto',
  'ObjetoImpuesto': 'objetoimpuesto',
  'TotalImpuestos': 'totalimpuestos',
  'Total': 'total',
  
  // Taxes
  'Tipo': 'tipo',
  'Tasa': 'tasa',
  
  // Management
  'TipoGestion': 'tipogestion',
  'Resultado': 'resultado',
  'FechaGestion': 'fechagestion',
  'FechaProximaGestion': 'fechaproximagestion',
  'PromesaPagoFecha': 'promesapagofecha',
  'PromesaPagoMonto': 'promesapagomonto',
  'RequiereSeguimiento': 'requiereseguimiento',
  'ComprobantePagoRecibido': 'comprobantepagorecibido',
  'PagoConfirmado': 'pagoconfirmado',
  'MotivoEscalamiento': 'motivoescalamiento',
  
  // Receipts
  'ImagenBase64': 'imagenbase64',
  'ImagenMimetype': 'imagenmimetype',
  'MontoDetectado': 'montodetectado',
  'FechaPagoDetectada': 'fechapagodetectada',
  'MetodoPagoDetectado': 'metodopagodetectado',
  'ReferenciaBancaria': 'referenciabancaria',
  'BancoOrigen': 'bancoorigen',
  'BancoDestino': 'bancodestino',
  'DatosExtraidosJSON': 'datosextraidosjson',
  'MotivoRechazo': 'motivorechazo',
  'FacturapiComplementoId': 'facturapicomplementoid',
  'UUIDComplemento': 'uuidcomplemento',
  'MensajeTexto': 'mensajetexto',
  'TelefonoCliente': 'telefonocliente',
  'FechaRecepcion': 'fecharecepcion',
  'FechaConfirmacion': 'fechaconfirmacion',
  'FechaRechazo': 'fecharechazo',
  'UsuarioConfirmoId': 'usuarioconfirmoid',
  'RecibidoFueraDeCiclo': 'recibidofueradeciclo',
  
  // Envios
  'Canal': 'canal',
  'EstadoEnvio': 'estadoenvio',
  'MensajeError': 'mensajeerror',
  'FechaEnvio': 'fechaenvio',
  'IdMensajeWhatsApp': 'idmensajewhatsapp',
  
  // Organization Baileys
  'SessionName': 'sessionname',
  'SesionData': 'sesiondata',
  'FechaConfiguracion': 'fechaconfiguracion',
  'UltimaActividad': 'ultimaactividad',
  
  // Config Cobranza
  'DiasGracia': 'diasgracia',
  'EscalamientoDias': 'escalamientodias',
  'EnvioAutomaticoRecordatorios': 'envioautomaticorecordatorios',
  'DiasRecordatorioPrevio': 'diasrecordatorioprevio',
  
  // Reminders
  'TipoMensaje': 'tipomensaje',
  'Destinatario': 'destinatario',
  'Asunto': 'asunto',
  'Mensaje': 'mensaje',
  'Visto': 'visto',
  'FechaVisto': 'fechavisto',
  'MetodoEnvio': 'metodoenvio',
  'MessageId': 'messageid',
  'ErrorMessage': 'errormessage',
  'CreadoPor': 'creadopor',
  'TipoRecordatorio': 'tiporecordatorio',
  
  // Suscripciones
  'StripeCustomerId': 'stripecustomerid',
  'StripeSubscriptionId': 'stripesubscriptionid',
  'StripePriceId': 'stripepriceid',
  'PlanSeleccionado': 'planseleccionado',
  'FechaInicio': 'fechainicio',
  'FechaFinPeriodo': 'fechafinperiodo',
  'TrialEnd': 'trialend',
  
  // PagosSuscripcion
  'StripeInvoiceId': 'stripeinvoiceid',
  'StripePaymentIntentId': 'stripepaymentintentid',
  'UrlRecibo': 'urlrecibo',
  
  // DatosFacturacion
  'RequiereFactura': 'requierefactura',
  
  // Agentes
  'RolAgente': 'rolagente',
  
  // Regimen
  'ID_Regimen': 'id_regimen',
  'Codigo': 'codigo',
  
  // Estados
  'ClaveEstado': 'claveestado',
  'NombreEstado': 'nombreestado',
  
  // Paises
  'NombrePais': 'nombrepais',
  
  // Timestamps
  'CreatedAt': 'createdat',
  'UpdatedAt': 'updatedat',
  'FechaAsignacion': 'fechaasignacion',
  
  // CC (special)
  'CC': 'cc',
};

// Properties that should NOT be replaced in regular TypeScript code
// (only in SQL/DB access patterns)
const IGNORE_IN_CONTEXT = new Set([
  // These are too generic and used as TS variable/param names
]);

let totalChanges = 0;
let filesChanged = 0;

for (const dir of DIRS) {
  const files = findFiles(dir, EXTENSIONS);
  
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    const original = content;
    let changeCount = 0;
    
    // Sort by length (longest first) to avoid partial replacements
    const sortedKeys = Object.entries(DB_PROPERTY_MAP)
      .sort((a, b) => b[0].length - a[0].length);
    
    for (const [mixed, lower] of sortedKeys) {
      if (mixed === lower) continue; // Skip if already lowercase
      
      // Replace property access patterns: .PropertyName (after dot)
      // This matches obj.PropertyName but NOT other uses
      const dotPattern = new RegExp(
        `\\.${escapeRegex(mixed)}\\b`,
        'g'
      );
      
      const before = content;
      content = content.replace(dotPattern, `.${lower}`);
      
      // Also replace in TypeScript interfaces and type definitions
      // Pattern: PropertyName: type or PropertyName?: type
      // But be careful not to replace in non-DB contexts
      
      // Replace in destructuring: { PropertyName } or { PropertyName: alias }
      // Skip this for now - too risky
      
      const diff = countOccurrences(before, dotPattern) - countOccurrences(content, dotPattern);
      // Actually just count by checking if content changed
      if (content !== before) {
        const matches = before.match(dotPattern);
        changeCount += matches ? matches.length : 0;
      }
    }
    
    if (content !== original) {
      fs.writeFileSync(file, content, 'utf-8');
      const relPath = path.relative(path.join(__dirname, '..'), file);
      console.log(`  ${relPath}: ${changeCount} property accesses fixed`);
      totalChanges += changeCount;
      filesChanged++;
    }
  }
}

console.log(`\nDone! ${totalChanges} property access fixes across ${filesChanged} files.`);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(str: string, pattern: RegExp): number {
  const matches = str.match(pattern);
  return matches ? matches.length : 0;
}
