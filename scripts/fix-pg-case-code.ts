/**
 * Script to fix PostgreSQL case sensitivity in SQL queries.
 * 
 * After renaming all tables/columns to lowercase in PostgreSQL,
 * we need to lowercase all double-quoted identifiers in SQL strings
 * in the TypeScript code.
 * 
 * Examples:
 *   "Id"  → id  (remove quotes, already lowercase via PG)
 *   "Correo" → correo
 *   "Usuarios" → usuarios
 *   "Usuario_Organizacion" → usuario_organizacion
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories to process
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

// Known identifiers that appear double-quoted in SQL strings
// Map from quoted form to lowercase
const QUOTED_IDENTIFIERS: Record<string, string> = {
  // Table names
  '"Usuarios"': 'usuarios',
  '"Clientes"': 'clientes',
  '"Facturas"': 'facturas',
  '"Pagos"': 'pagos',
  '"Organizaciones"': 'organizaciones',
  '"Usuario_Organizacion"': 'usuario_organizacion',
  '"Roles"': 'roles',
  '"ConceptosFactura"': 'conceptosfactura',
  '"ImpuestosConcepto"': 'impuestosconcepto',
  '"ComprobantesRecibidos"': 'comprobantesrecibidos',
  '"ConfiguracionCobranza"': 'configuracioncobranza',
  '"GestionesCobranza"': 'gestionescobranza',
  '"FacturaEnvios"': 'facturaenvios',
  '"Recordatorios"': 'recordatorios',
  '"RecordatoriosProgramados"': 'recordatoriosprogramados',
  '"Suscripciones"': 'suscripciones',
  '"PagosSuscripcion"': 'pagossuscripcion',
  '"DatosFacturacionSuscripcion"': 'datosfacturacionsuscripcion',
  '"Organizaciones_BaileysSession"': 'organizaciones_baileyssession',
  '"Agentes_Clientes"': 'agentes_clientes',
  '"Estados"': 'estados',
  '"Paises"': 'paises',
  '"Regimen"': 'regimen',
  
  // Column names - Usuarios
  '"Id"': 'id',
  '"Correo"': 'correo',
  '"Contrasena"': 'contrasena',
  '"NumeroTel"': 'numerotel',
  '"Activo"': 'activo',
  '"Nombre"': 'nombre',
  '"Apellido"': 'apellido',
  '"FechaCreacion"': 'fechacreacion',
  
  // Column names - Clientes
  '"NombreComercial"': 'nombrecomercial',
  '"RazonSocial"': 'razonsocial',
  '"RFC"': 'rfc',
  '"RegimenFiscal"': 'regimenfiscal',
  '"CondicionesPago"': 'condicionespago',
  '"CorreoPrincipal"': 'correoprincipal',
  '"Pais"': 'pais',
  '"CodigoPais"': 'codigopais',
  '"Telefono"': 'telefono',
  '"Estado"': 'estado',
  '"Calle"': 'calle',
  '"NumeroExterior"': 'numeroexterior',
  '"NumeroInterior"': 'numerointerior',
  '"CodigoPostal"': 'codigopostal',
  '"Colonia"': 'colonia',
  '"Ciudad"': 'ciudad',
  '"OrganizacionId"': 'organizacionid',
  '"RegimenFiscalId"': 'regimenfiscalid',
  '"EstadoId"': 'estadoid',
  '"PaisId"': 'paisid',
  '"IdClienteFacturaAPI"': 'idclientefacturaapi',
  '"FechaRegistroFacturaAPI"': 'fecharegistrofacturaapi',
  '"SincronizadoFacturaAPI"': 'sincronizadofacturaapi',
  '"ErrorSincronizacionFacturaAPI"': 'errorsincronizacionfacturaapi',
  '"TelefonoWhatsApp"': 'telefonowhatsapp',
  '"AutoComplementoPago"': 'autocomplementopago',
  
  // Column names - Facturas
  '"ClienteId"': 'clienteid',
  '"MontoTotal"': 'montototal',
  '"FechaEmision"': 'fechaemision',
  '"FechaVencimiento"': 'fechavencimiento',
  '"CreatedAt"': 'createdat',
  '"SaldoPendiente"': 'saldopendiente',
  '"DiasVencido"': 'diasvencido',
  '"UltimaGestion"': 'ultimagestion',
  '"Observaciones"': 'observaciones',
  '"FechaUltimoPago"': 'fechaultimopago',
  '"RecurrenciaActiva"': 'recurrenciaactiva',
  '"OrdenRecurrencia"': 'ordenrecurrencia',
  '"IdentificadorRecurrencia"': 'identificadorrecurrencia',
  '"FechaInicioRecurrencia"': 'fechainiciorecurrencia',
  '"FechaPrimeraFactura"': 'fechaprimerafactura',
  '"PeriodoRecurrencia"': 'periodorecurrencia',
  '"DiaRecurrencia"': 'diarecurrencia',
  '"CadaRecurrencia"': 'cadarecurrencia',
  '"FinRecurrencia"': 'finrecurrencia',
  '"FechaFinRecurrencia"': 'fechafinrecurrencia',
  '"NumeroOcurrencias"': 'numeroocurrencias',
  '"OrdenCompra"': 'ordencompra',
  '"Moneda"': 'moneda',
  '"TipoCambio"': 'tipocambio',
  '"NotasCliente"': 'notascliente',
  '"NotasInternas"': 'notasinternas',
  '"UUIDFacturapi"': 'uuidfacturapi',
  '"PDFUrl"': 'pdfurl',
  '"XMLUrl"': 'xmlurl',
  '"DesglosarImpuestos"': 'desglosarimpuestos',
  '"Identificador"': 'identificador',
  '"MetodoPago"': 'metodopago',
  '"UsuarioCreadorId"': 'usuariocreadorid',
  '"FormaPago"': 'formapago',
  '"UUID"': 'uuid',
  '"Timbrado"': 'timbrado',
  '"FechaTimbrado"': 'fechatimbrado',
  '"FacturapiId"': 'facturapiid',
  '"UsoCFDI"': 'usocfdi',
  '"PDFBase64"': 'pdfbase64',
  '"XMLBase64"': 'xmlbase64',
  '"AgenteIAActivo"': 'agenteiaactivo',
  '"MotivoCancelacion"': 'motivocancelacion',
  '"MotivoCancelacionDescripcion"': 'motivocancelaciondescripcion',
  '"EstadoCancelacion"': 'estadocancelacion',
  '"FacturaSustitucionId"': 'facturasustitucionid',
  '"FechaCancelacion"': 'fechacancelacion',
  '"UltimaFacturaGenerada"': 'ultimafacturagenerada',
  '"FacturasGeneradas"': 'facturasgeneradas',
  '"EnviarPorCorreo"': 'enviarporcorreo',
  '"EnviarPorWhatsApp"': 'enviarporwhatsapp',
  '"FacturaOrigenId"': 'facturaorigenid',
  
  // Column names - Pagos
  '"UsuarioId"': 'usuarioid',
  '"Monto"': 'monto',
  '"FechaPago"': 'fechapago',
  '"Metodo"': 'metodo',
  '"UpdatedAt"': 'updatedat',
  '"FacturapiPagoId"': 'facturapipagoid',
  '"UUIDPago"': 'uuidpago',
  '"Cancelado"': 'cancelado',
  '"ComprobanteBase64"': 'comprobantebase64',
  '"ComprobanteMimetype"': 'comprobantemimetype',
  '"TokenComprobante"': 'tokencomprobante',
  '"TokenExpiracion"': 'tokenexpiracion',
  
  // Column names - ConceptosFactura
  '"FacturaId"': 'facturaid',
  '"Descripcion"': 'descripcion',
  '"ClaveProdServ"': 'claveprodserv',
  '"UnidadMedida"': 'unidadmedida',
  '"Cantidad"': 'cantidad',
  '"PrecioUnitario"': 'preciounitario',
  '"Subtotal"': 'subtotal',
  '"MonedaProducto"': 'monedaproducto',
  '"ObjetoImpuesto"': 'objetoimpuesto',
  '"TotalImpuestos"': 'totalimpuestos',
  '"Total"': 'total',
  
  // Column names - ImpuestosConcepto
  '"ConceptoId"': 'conceptoid',
  '"Tipo"': 'tipo',
  '"Tasa"': 'tasa',
  
  // Column names - GestionesCobranza
  '"TipoGestion"': 'tipogestion',
  '"Resultado"': 'resultado',
  '"FechaGestion"': 'fechagestion',
  '"FechaProximaGestion"': 'fechaproximagestion',
  '"PromesaPagoFecha"': 'promesapagofecha',
  '"PromesaPagoMonto"': 'promesapagomonto',
  '"RequiereSeguimiento"': 'requiereseguimiento',
  '"ComprobantePagoRecibido"': 'comprobantepagorecibido',
  '"PagoConfirmado"': 'pagoconfirmado',
  '"MotivoEscalamiento"': 'motivoescalamiento',
  
  // Column names - ComprobantesRecibidos
  '"ImagenBase64"': 'imagenbase64',
  '"ImagenMimetype"': 'imagenmimetype',
  '"MontoDetectado"': 'montodetectado',
  '"FechaPagoDetectada"': 'fechapagodetectada',
  '"MetodoPagoDetectado"': 'metodopagodetectado',
  '"ReferenciaBancaria"': 'referenciabancaria',
  '"BancoOrigen"': 'bancoorigen',
  '"BancoDestino"': 'bancodestino',
  '"DatosExtraidosJSON"': 'datosextraidosjson',
  '"MotivoRechazo"': 'motivorechazo',
  '"PagoId"': 'pagoid',
  '"FacturapiComplementoId"': 'facturapicomplementoid',
  '"UUIDComplemento"': 'uuidcomplemento',
  '"MensajeTexto"': 'mensajetexto',
  '"TelefonoCliente"': 'telefonocliente',
  '"FechaRecepcion"': 'fecharecepcion',
  '"FechaConfirmacion"': 'fechaconfirmacion',
  '"FechaRechazo"': 'fecharechazo',
  '"UsuarioConfirmoId"': 'usuarioconfirmoid',
  '"RecibidoFueraDeCiclo"': 'recibidofueradeciclo',
  
  // Column names - FacturaEnvios
  '"Canal"': 'canal',
  '"EstadoEnvio"': 'estadoenvio',
  '"MensajeError"': 'mensajeerror',
  '"FechaEnvio"': 'fechaenvio',
  '"IdMensajeWhatsApp"': 'idmensajewhatsapp',
  
  // Column names - Organizaciones
  '"CorreoElectronico"': 'correoelectronico',
  '"IdFacturaAPI"': 'idfacturaapi',
  '"ApiKeyFacturaAPI"': 'apikeyfacturaapi',
  '"FechaActualizacionApiKey"': 'fechaactualizacionapikey',
  
  // Column names - Organizaciones_BaileysSession
  '"SessionName"': 'sessionname',
  '"SesionData"': 'sesiondata',
  '"FechaConfiguracion"': 'fechaconfiguracion',
  '"UltimaActividad"': 'ultimaactividad',
  
  // Column names - ConfiguracionCobranza
  '"DiasGracia"': 'diasgracia',
  '"EscalamientoDias"': 'escalamientodias',
  '"EnvioAutomaticoRecordatorios"': 'envioautomaticorecordatorios',
  '"DiasRecordatorioPrevio"': 'diasrecordatorioprevio',
  
  // Column names - Recordatorios
  '"TipoMensaje"': 'tipomensaje',
  '"Destinatario"': 'destinatario',
  '"CC"': 'cc',
  '"Asunto"': 'asunto',
  '"Mensaje"': 'mensaje',
  '"Visto"': 'visto',
  '"FechaVisto"': 'fechavisto',
  '"MetodoEnvio"': 'metodoenvio',
  '"MessageId"': 'messageid',
  '"ErrorMessage"': 'errormessage',
  '"CreadoPor"': 'creadopor',
  
  // Column names - RecordatoriosProgramados
  '"TipoRecordatorio"': 'tiporecordatorio',
  
  // Column names - DatosFacturacionSuscripcion
  '"RequiereFactura"': 'requierefactura',

  // Column names - Suscripciones
  '"StripeCustomerId"': 'stripecustomerid',
  '"StripeSubscriptionId"': 'stripesubscriptionid',
  '"StripePriceId"': 'stripepriceid',
  '"PlanSeleccionado"': 'planseleccionado',
  '"FechaInicio"': 'fechainicio',
  '"FechaFinPeriodo"': 'fechafinperiodo',
  '"TrialEnd"': 'trialend',
  
  // Column names - PagosSuscripcion
  '"SuscripcionId"': 'suscripcionid',
  '"StripeInvoiceId"': 'stripeinvoiceid',
  '"StripePaymentIntentId"': 'stripepaymentintentid',
  '"UrlRecibo"': 'urlrecibo',
  
  // Column names - Agentes_Clientes
  '"RolAgente"': 'rolagente',
  
  // Column names - Regimen
  '"ID_Regimen"': 'id_regimen',
  '"Codigo"': 'codigo',
  
  // Column names - Estados
  '"ClaveEstado"': 'claveestado',
  '"NombreEstado"': 'nombreestado',
  '"PaisID"': 'paisid',
  '"ID"': 'id',
  
  // Column names - Paises
  '"NombrePais"': 'nombrepais',
};

// Also need to handle alias patterns like: "Id" as id, "Correo" as correo
// These should become: id, correo (remove the alias since it's now the same)

let totalChanges = 0;
let filesChanged = 0;

for (const dir of DIRS) {
  const files = findFiles(dir, EXTENSIONS);
  
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    const original = content;
    
    // Sort by length (longest first) to avoid partial replacements
    const sortedKeys = Object.keys(QUOTED_IDENTIFIERS).sort((a, b) => b.length - a.length);
    
    let changeCount = 0;
    
    for (const quoted of sortedKeys) {
      const lower = QUOTED_IDENTIFIERS[quoted];
      
      // Only replace inside SQL strings (backtick templates and single-quoted strings)
      // We'll do a simple global replace since these patterns are SQL-specific
      while (content.includes(quoted)) {
        content = content.replace(quoted, lower);
        changeCount++;
      }
    }
    
    // Also handle patterns like: "Id" as id → id (redundant alias)
    // And: columnname as id → keep as is
    
    if (content !== original) {
      fs.writeFileSync(file, content, 'utf-8');
      const relPath = path.relative(path.join(__dirname, '..'), file);
      console.log(`  ${relPath}: ${changeCount} replacements`);
      totalChanges += changeCount;
      filesChanged++;
    }
  }
}

console.log(`\nDone! ${totalChanges} replacements across ${filesChanged} files.`);
