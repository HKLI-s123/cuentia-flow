-- =========================================================
-- Fix PostgreSQL case sensitivity: rename all mixed-case
-- tables and columns to lowercase
-- =========================================================

-- Disable FK checks temporarily
SET session_replication_role = 'replica';

-- =====================
-- RENAME TABLES
-- =====================
ALTER TABLE "Agentes_Clientes" RENAME TO agentes_clientes;
ALTER TABLE "Clientes" RENAME TO clientes;
ALTER TABLE "ComprobantesRecibidos" RENAME TO comprobantesrecibidos;
ALTER TABLE "ConceptosFactura" RENAME TO conceptosfactura;
ALTER TABLE "ConfiguracionCobranza" RENAME TO configuracioncobranza;
ALTER TABLE "DatosFacturacionSuscripcion" RENAME TO datosfacturacionsuscripcion;
ALTER TABLE "Estados" RENAME TO estados;
ALTER TABLE "FacturaEnvios" RENAME TO facturaenvios;
ALTER TABLE "Facturas" RENAME TO facturas;
ALTER TABLE "GestionesCobranza" RENAME TO gestionescobranza;
ALTER TABLE "ImpuestosConcepto" RENAME TO impuestosconcepto;
ALTER TABLE "Organizaciones" RENAME TO organizaciones;
ALTER TABLE "Organizaciones_BaileysSession" RENAME TO organizaciones_baileyssession;
ALTER TABLE "Pagos" RENAME TO pagos;
ALTER TABLE "PagosSuscripcion" RENAME TO pagossuscripcion;
ALTER TABLE "Paises" RENAME TO paises;
ALTER TABLE "Recordatorios" RENAME TO recordatorios;
ALTER TABLE "RecordatoriosProgramados" RENAME TO recordatoriosprogramados;
ALTER TABLE "Regimen" RENAME TO regimen;
ALTER TABLE "Roles" RENAME TO roles;
ALTER TABLE "Suscripciones" RENAME TO suscripciones;
ALTER TABLE "Usuario_Organizacion" RENAME TO usuario_organizacion;
ALTER TABLE "Usuarios" RENAME TO usuarios;
-- audit_log, auditoria_intentos_registro, configuracion_organizacion,
-- estados_factura, prioridades_cobranza are already lowercase

-- =====================
-- RENAME COLUMNS - agentes_clientes
-- =====================
ALTER TABLE agentes_clientes RENAME COLUMN "Id" TO id;
ALTER TABLE agentes_clientes RENAME COLUMN "ClienteId" TO clienteid;
ALTER TABLE agentes_clientes RENAME COLUMN "UsuarioId" TO usuarioid;
ALTER TABLE agentes_clientes RENAME COLUMN "RolAgente" TO rolagente;
ALTER TABLE agentes_clientes RENAME COLUMN "CreatedAt" TO createdat;
ALTER TABLE agentes_clientes RENAME COLUMN "UpdatedAt" TO updatedat;

-- =====================
-- RENAME COLUMNS - clientes
-- =====================
ALTER TABLE clientes RENAME COLUMN "Id" TO id;
ALTER TABLE clientes RENAME COLUMN "NombreComercial" TO nombrecomercial;
ALTER TABLE clientes RENAME COLUMN "RazonSocial" TO razonsocial;
ALTER TABLE clientes RENAME COLUMN "RFC" TO rfc;
ALTER TABLE clientes RENAME COLUMN "RegimenFiscal" TO regimenfiscal;
ALTER TABLE clientes RENAME COLUMN "CondicionesPago" TO condicionespago;
ALTER TABLE clientes RENAME COLUMN "CorreoPrincipal" TO correoprincipal;
ALTER TABLE clientes RENAME COLUMN "Pais" TO pais;
ALTER TABLE clientes RENAME COLUMN "CodigoPais" TO codigopais;
ALTER TABLE clientes RENAME COLUMN "Telefono" TO telefono;
ALTER TABLE clientes RENAME COLUMN "Estado" TO estado;
ALTER TABLE clientes RENAME COLUMN "Calle" TO calle;
ALTER TABLE clientes RENAME COLUMN "NumeroExterior" TO numeroexterior;
ALTER TABLE clientes RENAME COLUMN "NumeroInterior" TO numerointerior;
ALTER TABLE clientes RENAME COLUMN "CodigoPostal" TO codigopostal;
ALTER TABLE clientes RENAME COLUMN "Colonia" TO colonia;
ALTER TABLE clientes RENAME COLUMN "Ciudad" TO ciudad;
ALTER TABLE clientes RENAME COLUMN "OrganizacionId" TO organizacionid;
ALTER TABLE clientes RENAME COLUMN "RegimenFiscalId" TO regimenfiscalid;
ALTER TABLE clientes RENAME COLUMN "EstadoId" TO estadoid;
ALTER TABLE clientes RENAME COLUMN "PaisId" TO paisid;
ALTER TABLE clientes RENAME COLUMN "IdClienteFacturaAPI" TO idclientefacturaapi;
ALTER TABLE clientes RENAME COLUMN "FechaRegistroFacturaAPI" TO fecharegistrofacturaapi;
ALTER TABLE clientes RENAME COLUMN "SincronizadoFacturaAPI" TO sincronizadofacturaapi;
ALTER TABLE clientes RENAME COLUMN "ErrorSincronizacionFacturaAPI" TO errorsincronizacionfacturaapi;
ALTER TABLE clientes RENAME COLUMN "TelefonoWhatsApp" TO telefonowhatsapp;
ALTER TABLE clientes RENAME COLUMN "AutoComplementoPago" TO autocomplementopago;

-- =====================
-- RENAME COLUMNS - comprobantesrecibidos
-- =====================
ALTER TABLE comprobantesrecibidos RENAME COLUMN "Id" TO id;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "FacturaId" TO facturaid;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "OrganizacionId" TO organizacionid;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "ImagenBase64" TO imagenbase64;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "ImagenMimetype" TO imagenmimetype;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "MontoDetectado" TO montodetectado;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "FechaPagoDetectada" TO fechapagodetectada;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "MetodoPagoDetectado" TO metodopagodetectado;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "ReferenciaBancaria" TO referenciabancaria;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "BancoOrigen" TO bancoorigen;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "BancoDestino" TO bancodestino;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "DatosExtraidosJSON" TO datosextraidosjson;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "Estado" TO estado;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "MotivoRechazo" TO motivorechazo;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "PagoId" TO pagoid;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "FacturapiComplementoId" TO facturapicomplementoid;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "UUIDComplemento" TO uuidcomplemento;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "MensajeTexto" TO mensajetexto;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "TelefonoCliente" TO telefonocliente;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "FechaRecepcion" TO fecharecepcion;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "FechaConfirmacion" TO fechaconfirmacion;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "FechaRechazo" TO fecharechazo;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "UsuarioConfirmoId" TO usuarioconfirmoid;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "CreatedAt" TO createdat;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "UpdatedAt" TO updatedat;
ALTER TABLE comprobantesrecibidos RENAME COLUMN "RecibidoFueraDeCiclo" TO recibidofueradeciclo;

-- =====================
-- RENAME COLUMNS - conceptosfactura
-- =====================
ALTER TABLE conceptosfactura RENAME COLUMN "Id" TO id;
ALTER TABLE conceptosfactura RENAME COLUMN "FacturaId" TO facturaid;
ALTER TABLE conceptosfactura RENAME COLUMN "Nombre" TO nombre;
ALTER TABLE conceptosfactura RENAME COLUMN "Descripcion" TO descripcion;
ALTER TABLE conceptosfactura RENAME COLUMN "ClaveProdServ" TO claveprodserv;
ALTER TABLE conceptosfactura RENAME COLUMN "UnidadMedida" TO unidadmedida;
ALTER TABLE conceptosfactura RENAME COLUMN "Cantidad" TO cantidad;
ALTER TABLE conceptosfactura RENAME COLUMN "PrecioUnitario" TO preciounitario;
ALTER TABLE conceptosfactura RENAME COLUMN "Subtotal" TO subtotal;
ALTER TABLE conceptosfactura RENAME COLUMN "MonedaProducto" TO monedaproducto;
ALTER TABLE conceptosfactura RENAME COLUMN "ObjetoImpuesto" TO objetoimpuesto;
ALTER TABLE conceptosfactura RENAME COLUMN "TotalImpuestos" TO totalimpuestos;
ALTER TABLE conceptosfactura RENAME COLUMN "Total" TO total;

-- =====================
-- RENAME COLUMNS - configuracioncobranza
-- =====================
ALTER TABLE configuracioncobranza RENAME COLUMN "Id" TO id;
ALTER TABLE configuracioncobranza RENAME COLUMN "OrganizacionId" TO organizacionid;
ALTER TABLE configuracioncobranza RENAME COLUMN "DiasGracia" TO diasgracia;
ALTER TABLE configuracioncobranza RENAME COLUMN "EscalamientoDias" TO escalamientodias;
ALTER TABLE configuracioncobranza RENAME COLUMN "EnvioAutomaticoRecordatorios" TO envioautomaticorecordatorios;
ALTER TABLE configuracioncobranza RENAME COLUMN "DiasRecordatorioPrevio" TO diasrecordatorioprevio;

-- =====================
-- RENAME COLUMNS - datosfacturacionsuscripcion
-- =====================
ALTER TABLE datosfacturacionsuscripcion RENAME COLUMN "Id" TO id;
ALTER TABLE datosfacturacionsuscripcion RENAME COLUMN "OrganizacionId" TO organizacionid;
ALTER TABLE datosfacturacionsuscripcion RENAME COLUMN "RequiereFactura" TO requierefactura;
ALTER TABLE datosfacturacionsuscripcion RENAME COLUMN "RFC" TO rfc;
ALTER TABLE datosfacturacionsuscripcion RENAME COLUMN "RazonSocial" TO razonsocial;
ALTER TABLE datosfacturacionsuscripcion RENAME COLUMN "RegimenFiscalId" TO regimenfiscalid;
ALTER TABLE datosfacturacionsuscripcion RENAME COLUMN "UsoCFDI" TO usocfdi;
ALTER TABLE datosfacturacionsuscripcion RENAME COLUMN "Correo" TO correo;
ALTER TABLE datosfacturacionsuscripcion RENAME COLUMN "CodigoPostal" TO codigopostal;
ALTER TABLE datosfacturacionsuscripcion RENAME COLUMN "CreatedAt" TO createdat;
ALTER TABLE datosfacturacionsuscripcion RENAME COLUMN "UpdatedAt" TO updatedat;

-- =====================
-- RENAME COLUMNS - estados
-- =====================
ALTER TABLE estados RENAME COLUMN "ID" TO id;
ALTER TABLE estados RENAME COLUMN "ClaveEstado" TO claveestado;
ALTER TABLE estados RENAME COLUMN "NombreEstado" TO nombreestado;
ALTER TABLE estados RENAME COLUMN "PaisID" TO paisid;

-- =====================
-- RENAME COLUMNS - facturaenvios
-- =====================
ALTER TABLE facturaenvios RENAME COLUMN "Id" TO id;
ALTER TABLE facturaenvios RENAME COLUMN "FacturaId" TO facturaid;
ALTER TABLE facturaenvios RENAME COLUMN "OrganizacionId" TO organizacionid;
ALTER TABLE facturaenvios RENAME COLUMN "ClienteId" TO clienteid;
ALTER TABLE facturaenvios RENAME COLUMN "Canal" TO canal;
ALTER TABLE facturaenvios RENAME COLUMN "EstadoEnvio" TO estadoenvio;
ALTER TABLE facturaenvios RENAME COLUMN "MensajeError" TO mensajeerror;
ALTER TABLE facturaenvios RENAME COLUMN "FechaCreacion" TO fechacreacion;
ALTER TABLE facturaenvios RENAME COLUMN "FechaEnvio" TO fechaenvio;
ALTER TABLE facturaenvios RENAME COLUMN "IdMensajeWhatsApp" TO idmensajewhatsapp;

-- =====================
-- RENAME COLUMNS - facturas
-- =====================
ALTER TABLE facturas RENAME COLUMN "Id" TO id;
ALTER TABLE facturas RENAME COLUMN "ClienteId" TO clienteid;
ALTER TABLE facturas RENAME COLUMN "MontoTotal" TO montototal;
ALTER TABLE facturas RENAME COLUMN "FechaEmision" TO fechaemision;
ALTER TABLE facturas RENAME COLUMN "FechaVencimiento" TO fechavencimiento;
ALTER TABLE facturas RENAME COLUMN "CreatedAt" TO createdat;
ALTER TABLE facturas RENAME COLUMN "SaldoPendiente" TO saldopendiente;
ALTER TABLE facturas RENAME COLUMN "DiasVencido" TO diasvencido;
ALTER TABLE facturas RENAME COLUMN "UltimaGestion" TO ultimagestion;
ALTER TABLE facturas RENAME COLUMN "Observaciones" TO observaciones;
-- estado_factura_id, prioridad_cobranza_id, numero_factura are already lowercase
ALTER TABLE facturas RENAME COLUMN "FechaUltimoPago" TO fechaultimopago;
ALTER TABLE facturas RENAME COLUMN "RecurrenciaActiva" TO recurrenciaactiva;
ALTER TABLE facturas RENAME COLUMN "OrdenRecurrencia" TO ordenrecurrencia;
ALTER TABLE facturas RENAME COLUMN "IdentificadorRecurrencia" TO identificadorrecurrencia;
ALTER TABLE facturas RENAME COLUMN "FechaInicioRecurrencia" TO fechainiciorecurrencia;
ALTER TABLE facturas RENAME COLUMN "FechaPrimeraFactura" TO fechaprimerafactura;
ALTER TABLE facturas RENAME COLUMN "PeriodoRecurrencia" TO periodorecurrencia;
ALTER TABLE facturas RENAME COLUMN "DiaRecurrencia" TO diarecurrencia;
ALTER TABLE facturas RENAME COLUMN "CadaRecurrencia" TO cadarecurrencia;
ALTER TABLE facturas RENAME COLUMN "FinRecurrencia" TO finrecurrencia;
ALTER TABLE facturas RENAME COLUMN "FechaFinRecurrencia" TO fechafinrecurrencia;
ALTER TABLE facturas RENAME COLUMN "NumeroOcurrencias" TO numeroocurrencias;
ALTER TABLE facturas RENAME COLUMN "OrdenCompra" TO ordencompra;
ALTER TABLE facturas RENAME COLUMN "Moneda" TO moneda;
ALTER TABLE facturas RENAME COLUMN "TipoCambio" TO tipocambio;
ALTER TABLE facturas RENAME COLUMN "CondicionesPago" TO condicionespago;
ALTER TABLE facturas RENAME COLUMN "NotasCliente" TO notascliente;
ALTER TABLE facturas RENAME COLUMN "NotasInternas" TO notasinternas;
ALTER TABLE facturas RENAME COLUMN "UUIDFacturapi" TO uuidfacturapi;
ALTER TABLE facturas RENAME COLUMN "PDFUrl" TO pdfurl;
ALTER TABLE facturas RENAME COLUMN "XMLUrl" TO xmlurl;
ALTER TABLE facturas RENAME COLUMN "DesglosarImpuestos" TO desglosarimpuestos;
ALTER TABLE facturas RENAME COLUMN "Identificador" TO identificador;
ALTER TABLE facturas RENAME COLUMN "MetodoPago" TO metodopago;
ALTER TABLE facturas RENAME COLUMN "UsuarioCreadorId" TO usuariocreadorid;
ALTER TABLE facturas RENAME COLUMN "FormaPago" TO formapago;
ALTER TABLE facturas RENAME COLUMN "UUID" TO uuid;
ALTER TABLE facturas RENAME COLUMN "Timbrado" TO timbrado;
ALTER TABLE facturas RENAME COLUMN "FechaTimbrado" TO fechatimbrado;
ALTER TABLE facturas RENAME COLUMN "FacturapiId" TO facturapiid;
ALTER TABLE facturas RENAME COLUMN "UsoCFDI" TO usocfdi;
ALTER TABLE facturas RENAME COLUMN "PDFBase64" TO pdfbase64;
ALTER TABLE facturas RENAME COLUMN "XMLBase64" TO xmlbase64;
ALTER TABLE facturas RENAME COLUMN "AgenteIAActivo" TO agenteiaactivo;
ALTER TABLE facturas RENAME COLUMN "MotivoCancelacion" TO motivocancelacion;
ALTER TABLE facturas RENAME COLUMN "MotivoCancelacionDescripcion" TO motivocancelaciondescripcion;
ALTER TABLE facturas RENAME COLUMN "EstadoCancelacion" TO estadocancelacion;
ALTER TABLE facturas RENAME COLUMN "FacturaSustitucionId" TO facturasustitucionid;
ALTER TABLE facturas RENAME COLUMN "FechaCancelacion" TO fechacancelacion;
ALTER TABLE facturas RENAME COLUMN "UltimaFacturaGenerada" TO ultimafacturagenerada;
ALTER TABLE facturas RENAME COLUMN "FacturasGeneradas" TO facturasgeneradas;
ALTER TABLE facturas RENAME COLUMN "EnviarPorCorreo" TO enviarporcorreo;
ALTER TABLE facturas RENAME COLUMN "EnviarPorWhatsApp" TO enviarporwhatsapp;
ALTER TABLE facturas RENAME COLUMN "FacturaOrigenId" TO facturaorigenid;

-- =====================
-- RENAME COLUMNS - gestionescobranza
-- =====================
ALTER TABLE gestionescobranza RENAME COLUMN "Id" TO id;
ALTER TABLE gestionescobranza RENAME COLUMN "FacturaId" TO facturaid;
ALTER TABLE gestionescobranza RENAME COLUMN "UsuarioId" TO usuarioid;
ALTER TABLE gestionescobranza RENAME COLUMN "TipoGestion" TO tipogestion;
ALTER TABLE gestionescobranza RENAME COLUMN "Resultado" TO resultado;
ALTER TABLE gestionescobranza RENAME COLUMN "Descripcion" TO descripcion;
ALTER TABLE gestionescobranza RENAME COLUMN "FechaGestion" TO fechagestion;
ALTER TABLE gestionescobranza RENAME COLUMN "FechaProximaGestion" TO fechaproximagestion;
ALTER TABLE gestionescobranza RENAME COLUMN "PromesaPagoFecha" TO promesapagofecha;
ALTER TABLE gestionescobranza RENAME COLUMN "PromesaPagoMonto" TO promesapagomonto;
ALTER TABLE gestionescobranza RENAME COLUMN "RequiereSeguimiento" TO requiereseguimiento;
ALTER TABLE gestionescobranza RENAME COLUMN "ComprobantePagoRecibido" TO comprobantepagorecibido;
ALTER TABLE gestionescobranza RENAME COLUMN "PagoConfirmado" TO pagoconfirmado;
ALTER TABLE gestionescobranza RENAME COLUMN "MotivoEscalamiento" TO motivoescalamiento;

-- =====================
-- RENAME COLUMNS - impuestosconcepto
-- =====================
ALTER TABLE impuestosconcepto RENAME COLUMN "Id" TO id;
ALTER TABLE impuestosconcepto RENAME COLUMN "ConceptoId" TO conceptoid;
ALTER TABLE impuestosconcepto RENAME COLUMN "Tipo" TO tipo;
ALTER TABLE impuestosconcepto RENAME COLUMN "Tasa" TO tasa;
ALTER TABLE impuestosconcepto RENAME COLUMN "Monto" TO monto;

-- =====================
-- RENAME COLUMNS - organizaciones
-- =====================
ALTER TABLE organizaciones RENAME COLUMN "Id" TO id;
ALTER TABLE organizaciones RENAME COLUMN "RFC" TO rfc;
ALTER TABLE organizaciones RENAME COLUMN "RazonSocial" TO razonsocial;
ALTER TABLE organizaciones RENAME COLUMN "CreatedAt" TO createdat;
ALTER TABLE organizaciones RENAME COLUMN "UpdatedAt" TO updatedat;
ALTER TABLE organizaciones RENAME COLUMN "CorreoElectronico" TO correoelectronico;
ALTER TABLE organizaciones RENAME COLUMN "Nombre" TO nombre;
ALTER TABLE organizaciones RENAME COLUMN "IdFacturaAPI" TO idfacturaapi;
ALTER TABLE organizaciones RENAME COLUMN "ApiKeyFacturaAPI" TO apikeyfacturaapi;
ALTER TABLE organizaciones RENAME COLUMN "FechaActualizacionApiKey" TO fechaactualizacionapikey;

-- =====================
-- RENAME COLUMNS - organizaciones_baileyssession
-- =====================
ALTER TABLE organizaciones_baileyssession RENAME COLUMN "Id" TO id;
ALTER TABLE organizaciones_baileyssession RENAME COLUMN "OrganizacionId" TO organizacionid;
ALTER TABLE organizaciones_baileyssession RENAME COLUMN "TelefonoWhatsApp" TO telefonowhatsapp;
ALTER TABLE organizaciones_baileyssession RENAME COLUMN "SessionName" TO sessionname;
ALTER TABLE organizaciones_baileyssession RENAME COLUMN "SesionData" TO sesiondata;
ALTER TABLE organizaciones_baileyssession RENAME COLUMN "Activo" TO activo;
ALTER TABLE organizaciones_baileyssession RENAME COLUMN "FechaConfiguracion" TO fechaconfiguracion;
ALTER TABLE organizaciones_baileyssession RENAME COLUMN "UltimaActividad" TO ultimaactividad;
ALTER TABLE organizaciones_baileyssession RENAME COLUMN "Estado" TO estado;

-- =====================
-- RENAME COLUMNS - pagos
-- =====================
ALTER TABLE pagos RENAME COLUMN "Id" TO id;
ALTER TABLE pagos RENAME COLUMN "FacturaId" TO facturaid;
ALTER TABLE pagos RENAME COLUMN "UsuarioId" TO usuarioid;
ALTER TABLE pagos RENAME COLUMN "Monto" TO monto;
ALTER TABLE pagos RENAME COLUMN "FechaPago" TO fechapago;
ALTER TABLE pagos RENAME COLUMN "Metodo" TO metodo;
ALTER TABLE pagos RENAME COLUMN "CreatedAt" TO createdat;
ALTER TABLE pagos RENAME COLUMN "UpdatedAt" TO updatedat;
ALTER TABLE pagos RENAME COLUMN "FacturapiPagoId" TO facturapipagoid;
ALTER TABLE pagos RENAME COLUMN "UUIDPago" TO uuidpago;
ALTER TABLE pagos RENAME COLUMN "Cancelado" TO cancelado;
ALTER TABLE pagos RENAME COLUMN "FechaCancelacion" TO fechacancelacion;
ALTER TABLE pagos RENAME COLUMN "MotivoCancelacion" TO motivocancelacion;
ALTER TABLE pagos RENAME COLUMN "ComprobanteBase64" TO comprobantebase64;
ALTER TABLE pagos RENAME COLUMN "ComprobanteMimetype" TO comprobantemimetype;
ALTER TABLE pagos RENAME COLUMN "TokenComprobante" TO tokencomprobante;
ALTER TABLE pagos RENAME COLUMN "TokenExpiracion" TO tokenexpiracion;

-- =====================
-- RENAME COLUMNS - pagossuscripcion
-- =====================
ALTER TABLE pagossuscripcion RENAME COLUMN "Id" TO id;
ALTER TABLE pagossuscripcion RENAME COLUMN "SuscripcionId" TO suscripcionid;
ALTER TABLE pagossuscripcion RENAME COLUMN "StripeInvoiceId" TO stripeinvoiceid;
ALTER TABLE pagossuscripcion RENAME COLUMN "StripePaymentIntentId" TO stripepaymentintentid;
ALTER TABLE pagossuscripcion RENAME COLUMN "Monto" TO monto;
ALTER TABLE pagossuscripcion RENAME COLUMN "Moneda" TO moneda;
ALTER TABLE pagossuscripcion RENAME COLUMN "Estado" TO estado;
ALTER TABLE pagossuscripcion RENAME COLUMN "FechaPago" TO fechapago;
ALTER TABLE pagossuscripcion RENAME COLUMN "UrlRecibo" TO urlrecibo;

-- =====================
-- RENAME COLUMNS - paises
-- =====================
ALTER TABLE paises RENAME COLUMN "ID" TO id;
ALTER TABLE paises RENAME COLUMN "NombrePais" TO nombrepais;

-- =====================
-- RENAME COLUMNS - recordatorios
-- =====================
ALTER TABLE recordatorios RENAME COLUMN "Id" TO id;
ALTER TABLE recordatorios RENAME COLUMN "FacturaId" TO facturaid;
ALTER TABLE recordatorios RENAME COLUMN "TipoMensaje" TO tipomensaje;
ALTER TABLE recordatorios RENAME COLUMN "Destinatario" TO destinatario;
ALTER TABLE recordatorios RENAME COLUMN "CC" TO cc;
ALTER TABLE recordatorios RENAME COLUMN "Asunto" TO asunto;
ALTER TABLE recordatorios RENAME COLUMN "Mensaje" TO mensaje;
ALTER TABLE recordatorios RENAME COLUMN "FechaEnvio" TO fechaenvio;
ALTER TABLE recordatorios RENAME COLUMN "Visto" TO visto;
ALTER TABLE recordatorios RENAME COLUMN "FechaVisto" TO fechavisto;
ALTER TABLE recordatorios RENAME COLUMN "MetodoEnvio" TO metodoenvio;
ALTER TABLE recordatorios RENAME COLUMN "Estado" TO estado;
ALTER TABLE recordatorios RENAME COLUMN "MessageId" TO messageid;
ALTER TABLE recordatorios RENAME COLUMN "ErrorMessage" TO errormessage;
ALTER TABLE recordatorios RENAME COLUMN "CreadoPor" TO creadopor;

-- =====================
-- RENAME COLUMNS - recordatoriosprogramados
-- =====================
ALTER TABLE recordatoriosprogramados RENAME COLUMN "Id" TO id;
ALTER TABLE recordatoriosprogramados RENAME COLUMN "ClienteId" TO clienteid;
ALTER TABLE recordatoriosprogramados RENAME COLUMN "FacturaId" TO facturaid;
ALTER TABLE recordatoriosprogramados RENAME COLUMN "TipoRecordatorio" TO tiporecordatorio;
ALTER TABLE recordatoriosprogramados RENAME COLUMN "FechaEnvio" TO fechaenvio;
ALTER TABLE recordatoriosprogramados RENAME COLUMN "Mensaje" TO mensaje;
ALTER TABLE recordatoriosprogramados RENAME COLUMN "Estado" TO estado;

-- =====================
-- RENAME COLUMNS - regimen
-- =====================
ALTER TABLE regimen RENAME COLUMN "ID_Regimen" TO id_regimen;
ALTER TABLE regimen RENAME COLUMN "Codigo" TO codigo;
ALTER TABLE regimen RENAME COLUMN "Descripcion" TO descripcion;

-- =====================
-- RENAME COLUMNS - roles
-- =====================
ALTER TABLE roles RENAME COLUMN "Id" TO id;
ALTER TABLE roles RENAME COLUMN "Nombre" TO nombre;

-- =====================
-- RENAME COLUMNS - suscripciones
-- =====================
ALTER TABLE suscripciones RENAME COLUMN "Id" TO id;
ALTER TABLE suscripciones RENAME COLUMN "OrganizacionId" TO organizacionid;
ALTER TABLE suscripciones RENAME COLUMN "StripeCustomerId" TO stripecustomerid;
ALTER TABLE suscripciones RENAME COLUMN "StripeSubscriptionId" TO stripesubscriptionid;
ALTER TABLE suscripciones RENAME COLUMN "StripePriceId" TO stripepriceid;
ALTER TABLE suscripciones RENAME COLUMN "PlanSeleccionado" TO planseleccionado;
ALTER TABLE suscripciones RENAME COLUMN "Estado" TO estado;
ALTER TABLE suscripciones RENAME COLUMN "FechaInicio" TO fechainicio;
ALTER TABLE suscripciones RENAME COLUMN "FechaFinPeriodo" TO fechafinperiodo;
ALTER TABLE suscripciones RENAME COLUMN "FechaCancelacion" TO fechacancelacion;
ALTER TABLE suscripciones RENAME COLUMN "TrialEnd" TO trialend;
ALTER TABLE suscripciones RENAME COLUMN "CreatedAt" TO createdat;
ALTER TABLE suscripciones RENAME COLUMN "UpdatedAt" TO updatedat;
ALTER TABLE suscripciones RENAME COLUMN "MotivoCancelacion" TO motivocancelacion;

-- =====================
-- RENAME COLUMNS - usuario_organizacion
-- =====================
ALTER TABLE usuario_organizacion RENAME COLUMN "Id" TO id;
ALTER TABLE usuario_organizacion RENAME COLUMN "UsuarioId" TO usuarioid;
ALTER TABLE usuario_organizacion RENAME COLUMN "OrganizacionId" TO organizacionid;
ALTER TABLE usuario_organizacion RENAME COLUMN "RolId" TO rolid;
ALTER TABLE usuario_organizacion RENAME COLUMN "CreatedAt" TO createdat;
ALTER TABLE usuario_organizacion RENAME COLUMN "UpdatedAt" TO updatedat;
ALTER TABLE usuario_organizacion RENAME COLUMN "FechaAsignacion" TO fechaasignacion;

-- =====================
-- RENAME COLUMNS - usuarios
-- =====================
ALTER TABLE usuarios RENAME COLUMN "Id" TO id;
ALTER TABLE usuarios RENAME COLUMN "Correo" TO correo;
ALTER TABLE usuarios RENAME COLUMN "Contrasena" TO contrasena;
ALTER TABLE usuarios RENAME COLUMN "NumeroTel" TO numerotel;
ALTER TABLE usuarios RENAME COLUMN "Activo" TO activo;
ALTER TABLE usuarios RENAME COLUMN "Nombre" TO nombre;
ALTER TABLE usuarios RENAME COLUMN "Apellido" TO apellido;
-- google_id, foto_url, provider, email_verified, verification_token,
-- verification_expires, password_reset_token, password_reset_expires, plan_id
-- are already lowercase

-- Re-enable FK checks
SET session_replication_role = 'origin';

-- Verify
SELECT 'Tables renamed successfully' as status;
