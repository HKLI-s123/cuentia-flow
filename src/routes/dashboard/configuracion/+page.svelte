<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import {
    Settings,
    Building2,
    Mail,
    FileText,
    Zap,
    Save,
    RefreshCw,
    Globe,
    Phone,
    MapPin,
    CreditCard,
    Users,
    Bell,
    Palette,
    Trash2,
    AlertTriangle,
    Smartphone,
    User,
    Lock,
    Eye,
    EyeOff,
    Check,
    Crown,
    ArrowUpRight,
    ExternalLink,
    Shield,
    Sparkles,
    Receipt
  } from 'lucide-svelte';
  import { Button, Input, Badge } from '$lib/components/ui';
  import { authFetch } from '$lib/api';

  // Estado de Cuenta (perfil de usuario)
  let datosCuenta = {
    id: 0,
    nombre: '',
    apellido: '',
    correo: '',
    correoOriginal: ''
  };
  let contrasenaActual = '';
  let nuevaContrasena = '';
  let confirmarContrasena = '';
  let guardandoCuenta = false;
  let cambiandoContrasena = false;
  let mensajeCuenta = '';
  let tipoMensajeCuenta = '';
  let mensajeContrasena = '';
  let tipoMensajeContrasena = '';
  let mostrarContrasenaActual = false;
  let mostrarNuevaContrasena = false;
  let mostrarConfirmarContrasena = false;

  // --- Validaciones del perfil ---
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const nombreRegex = /^[a-záéíóúñA-ZÁÉÍÓÚÑ\s'\-]+$/;

  // Errores de validación reactivos
  let erroresNombre = '';
  let erroresApellido = '';
  let erroresCorreo = '';

  $: {
    const n = datosCuenta.nombre.trim();
    if (!n) erroresNombre = 'El nombre es requerido';
    else if (n.length < 2) erroresNombre = 'Mínimo 2 caracteres';
    else if (n.length > 100) erroresNombre = 'Máximo 100 caracteres';
    else if (!nombreRegex.test(n)) erroresNombre = 'Solo se permiten letras, espacios, apóstrofes y guiones';
    else erroresNombre = '';
  }
  $: {
    const a = datosCuenta.apellido.trim();
    if (a && a.length < 2) erroresApellido = 'Mínimo 2 caracteres';
    else if (a && a.length > 100) erroresApellido = 'Máximo 100 caracteres';
    else if (a && !nombreRegex.test(a)) erroresApellido = 'Solo se permiten letras, espacios, apóstrofes y guiones';
    else erroresApellido = '';
  }
  $: {
    const c = datosCuenta.correo.trim();
    if (!c) erroresCorreo = 'El correo es requerido';
    else if (!emailRegex.test(c)) erroresCorreo = 'Formato de correo inválido';
    else if (c.length > 150) erroresCorreo = 'Máximo 150 caracteres';
    else erroresCorreo = '';
  }
  $: perfilValido = !erroresNombre && !erroresApellido && !erroresCorreo;

  // --- Validaciones de contraseña ---
  $: tieneMayuscula = /[A-Z]/.test(nuevaContrasena);
  $: tieneMinuscula = /[a-z]/.test(nuevaContrasena);
  $: tieneNumero = /[0-9]/.test(nuevaContrasena);
  $: tieneSimbolo = /[!@#$%^&*()_+=\-[\]{};':"\\|,.<>/?]/.test(nuevaContrasena);
  $: tieneMinimo = nuevaContrasena.length >= 10;
  $: fuerzaContrasena = [tieneMayuscula, tieneMinuscula, tieneNumero, tieneSimbolo, tieneMinimo].filter(Boolean).length;
  $: contrasenaValida = fuerzaContrasena === 5;
  $: contrasenasCoinciden = nuevaContrasena === confirmarContrasena && confirmarContrasena.length > 0;
  $: formContrasenaValido = contrasenaActual.length > 0 && contrasenaValida && contrasenasCoinciden;

  function etiquetaFuerza(nivel: number): string {
    if (nivel === 0) return '';
    if (nivel <= 2) return 'Débil';
    if (nivel <= 4) return 'Media';
    return 'Fuerte';
  }
  function colorFuerza(nivel: number): string {
    if (nivel <= 2) return 'bg-red-500';
    if (nivel <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  // Cargar datos del usuario actual
  async function cargarDatosCuenta() {
    try {
      const user = $page.data.user;
      if (user) {
        datosCuenta = {
          id: user.id || 0,
          nombre: user.nombre || '',
          apellido: user.apellido || '',
          correo: user.correo || '',
          correoOriginal: user.correo || ''
        };
      }
    } catch (error) {
      console.error('Error al cargar datos de cuenta:', error);
    }
  }

  // Guardar datos del perfil
  async function guardarDatosCuenta() {
    mensajeCuenta = '';

    if (!perfilValido) {
      mensajeCuenta = erroresNombre || erroresApellido || erroresCorreo;
      tipoMensajeCuenta = 'error';
      return;
    }

    guardandoCuenta = true;
    try {
      const response = await authFetch(`/api/auth/usuario/${datosCuenta.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          nombre: datosCuenta.nombre.trim(),
          apellido: datosCuenta.apellido.trim(),
          correo: datosCuenta.correo.trim().toLowerCase()
        })
      });

      const result = await response.json();
      if (response.ok) {
        mensajeCuenta = 'Datos actualizados correctamente';
        tipoMensajeCuenta = 'success';
        datosCuenta.correoOriginal = datosCuenta.correo.trim().toLowerCase();
        // Refrescar datos de sesión para que el nombre se actualice en toda la app
        const { invalidateAll } = await import('$app/navigation');
        await invalidateAll();
      } else {
        mensajeCuenta = result.error || 'Error al actualizar datos';
        tipoMensajeCuenta = 'error';
      }
    } catch (error) {
      mensajeCuenta = 'Error al conectar con el servidor';
      tipoMensajeCuenta = 'error';
    } finally {
      guardandoCuenta = false;
    }
  }

  // Cambiar contraseña
  async function cambiarContrasena() {
    mensajeContrasena = '';

    if (!contrasenaActual) {
      mensajeContrasena = 'Ingresa tu contraseña actual';
      tipoMensajeContrasena = 'error';
      return;
    }
    if (!contrasenaValida) {
      mensajeContrasena = 'La contraseña no cumple los requisitos de seguridad';
      tipoMensajeContrasena = 'error';
      return;
    }
    if (!contrasenasCoinciden) {
      mensajeContrasena = 'Las contraseñas no coinciden';
      tipoMensajeContrasena = 'error';
      return;
    }

    cambiandoContrasena = true;
    try {
      const response = await authFetch(`/api/auth/usuario/${datosCuenta.id}/cambiar-password`, {
        method: 'POST',
        body: JSON.stringify({
          contrasenaActual,
          nuevaContrasena
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        mensajeContrasena = 'Contraseña actualizada correctamente';
        tipoMensajeContrasena = 'success';
        contrasenaActual = '';
        nuevaContrasena = '';
        confirmarContrasena = '';
        mostrarContrasenaActual = false;
        mostrarNuevaContrasena = false;
        mostrarConfirmarContrasena = false;
      } else {
        mensajeContrasena = result.error || 'Error al cambiar contraseña';
        tipoMensajeContrasena = 'error';
      }
    } catch (error) {
      mensajeContrasena = 'Error al conectar con el servidor';
      tipoMensajeContrasena = 'error';
    } finally {
      cambiandoContrasena = false;
    }
  }

  // Cargar datos de cuenta cuando se selecciona el tab
  $: if (tabActivo === 'cuenta') {
    cargarDatosCuenta();
  }

  // Eliminar cuenta
  let mostrarModalEliminarCuenta = false;
  let contrasenaEliminar = '';
  let eliminandoCuenta = false;
  let errorEliminarCuenta = '';

  async function eliminarCuenta() {
    if (!contrasenaEliminar) {
      errorEliminarCuenta = 'Ingresa tu contraseña para confirmar';
      return;
    }
    eliminandoCuenta = true;
    errorEliminarCuenta = '';
    try {
      const response = await authFetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: contrasenaEliminar }),
      });
      const data = await response.json();
      if (!response.ok) {
        errorEliminarCuenta = data.error || 'Error al eliminar la cuenta';
        return;
      }
      // Limpiar sesión y redirigir
      window.location.href = '/login';
    } catch {
      errorEliminarCuenta = 'Error de conexión';
    } finally {
      eliminandoCuenta = false;
    }
  }

  // Estado de WhatsApp
  let whatsappStatus: 'desconectado' | 'pendiente' | 'activo' | 'error' | 'cargando' = 'cargando';
  let whatsappTelefono = '';
  let whatsappUltimaActividad = '';
  let cargandoWhatsApp = false;

  // Estado de la configuración
  let organizacionActual: any = {};
  let configuracionCobranza: any = {};
  let configuracionEmail: any = {};
  let cargando = true;
  let guardando = false;
  let eliminando = false;
  let mensaje = '';
  let tipoMensaje = '';
  let mostrarConfirmacionEliminar = false;
  let mostrarConfirmacionEliminarCert = false;
  let eliminarCertCargando = false;

  // Mensajes locales para cada sección
  let mensajeLogo = '';
  let tipoMensajeLogo = '';
  let mensajePersonalizacion = '';
  let tipoMensajePersonalizacion = '';

  // Branding / logotipo y personalización
  let logoFile: File | null = null;
  let logoPreviewUrl: string | null = null;
  let subiendoLogo = false;
  let customizacion = {
    color: '',
    nextFolioNumber: '',
    pdfExtraCodes: false,
    pdfExtraProductKey: false,
    hasLogo: false
  };
  let guardandoCustomizacion = false;

  // Estado de tabs - leer desde URL si viene ?tab=plan
  let tabActivo = 'organizacion';

  // ═══ Estado de Suscripción / Planes ═══
  interface Suscripcion {
    plan: string;
    estado: string;
    limites: {
      maxOrganizaciones: number;
      maxFacturasMes: number;
      maxClientes: number;
      whatsapp: boolean;
      agenteIA: boolean;
      complementoAutomatico: boolean;
      api: boolean;
    };
    fechaInicio: string | null;
    fechaFinPeriodo: string | null;
    canceladaEn: string | null;
    tieneStripe: boolean;
    totalPagos: number;
    descuento: {
      porcentaje: number;
      nombre: string;
      mesesRestantes: number | null;
    } | null;
    pagos?: Array<{
      Monto: number;
      Moneda: string;
      Estado: string;
      FechaPago: string;
      UrlRecibo: string | null;
    }>;
  }

  let suscripcion: Suscripcion | null = null;
  let cargandoSuscripcion = false;
  let procesandoCheckout = false;
  let procesandoPortal = false;
  let mensajePlan = '';
  let tipoMensajePlan = '';

  // ═══ Estado de Cambio de Plan ═══
  let mostrarModalCambio = false;
  let planDestino: typeof planesInfo[0] | null = null;
  let procesandoCambio = false;

  let mostrarFormularioPersonalizado = false;
  let formPersonalizado = {
    requiereFacturas: '',
    requiereClientes: '',
    requiereIntegraciones: '',
    necesidesEspeciales: ''
  };
  let enviadoFormPersonalizado = false;
  let procesandoFormPersonalizado = false;
  let motivoCancelacion = '';
  let procesandoCancelacion = false;

  const preciosPlanes: Record<string, number> = { basico: 399, pro: 799, enterprise: 1499 };
  $: precioOriginal = suscripcion ? (preciosPlanes[suscripcion.plan] || 0) : 0;
  $: precioConDescuento = Math.round(precioOriginal * 0.7);
  $: ahorroMensual = precioOriginal - precioConDescuento;

  const planesInfo = [
    {
      id: 'basico',
      nombre: 'Básico',
      precio: '$399',
      periodo: 'MXN/mes',
      descripcion: 'Para emprendedores y freelancers',
      color: 'slate',
      features: ['1 organización', '50 facturas/mes', '50 clientes', 'WhatsApp + Correo', 'Cobrador IA', 'Dashboard básico'],
      gradient: 'from-slate-50 to-gray-50',
      border: 'border-slate-200',
      badge: 'bg-slate-100 text-slate-700',
      btn: 'border-slate-300 text-slate-700 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50',
    },
    {
      id: 'pro',
      nombre: 'Pro',
      precio: '$799',
      periodo: 'MXN/mes',
      descripcion: 'Para PyMEs en crecimiento',
      color: 'indigo',
      popular: true,
      features: ['3 organizaciones', '200 facturas/mes', '200 clientes', 'WhatsApp + Correo', 'Cobrador IA', 'Complemento automático', 'Reportes avanzados'],
      gradient: 'from-indigo-50 to-violet-50',
      border: 'border-indigo-400',
      badge: 'bg-indigo-100 text-indigo-700',
      btn: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-200/50',
    },
    {
      id: 'enterprise',
      nombre: 'Enterprise',
      precio: '$1,499',
      periodo: 'MXN/mes',
      descripcion: 'Para grandes empresas',
      color: 'slate',
      features: ['Organizaciones ilimitadas', '500 facturas/mes', '500 clientes', 'Cobrador IA avanzado', 'API para integraciones', 'Soporte prioritario'],
      gradient: 'bg-gradient-to-br from-slate-800 to-slate-900',
      border: 'border-slate-700',
      badge: 'bg-slate-800 text-white',
      btn: 'border-white/30 text-white hover:bg-white/10 hover:border-white/50',
      dark: true,
    },
    {
      id: 'personalizado',
      nombre: 'Personalizado',
      precio: 'A consultar',
      periodo: 'Según tu necesidad',
      descripcion: 'Solución customizada para tu empresa',
      color: 'purple',
      features: ['Límites personalizados', 'Integraciones específicas', 'SLA garantizado', 'Soporte 24/7', 'Consultor dedicado', 'Actualizaciones prioritarias'],
      gradient: 'from-purple-50 to-pink-50',
      border: 'border-purple-400',
      badge: 'bg-purple-100 text-purple-700',
      btn: 'border-purple-300 text-purple-700 hover:border-purple-500 hover:text-purple-900 hover:bg-purple-50',
      custom: true,
    }
  ];

  async function cargarSuscripcion() {
    cargandoSuscripcion = true;
    try {
      const response = await authFetch('/api/stripe/subscription');
      if (response.ok) {
        suscripcion = await response.json();
      }
    } catch (error) {
      console.error('Error cargando suscripción:', error);
    } finally {
      cargandoSuscripcion = false;
    }
  }

  async function iniciarCheckout(plan: string) {
    procesandoCheckout = true;
    mensajePlan = '';
    try {
      const response = await authFetch('/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan })
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        mensajePlan = data.error || 'Error al iniciar checkout';
        tipoMensajePlan = 'error';
      }
    } catch {
      mensajePlan = 'Error al conectar con el servidor';
      tipoMensajePlan = 'error';
    } finally {
      procesandoCheckout = false;
    }
  }

  async function abrirPortalFacturacion() {
    procesandoPortal = true;
    try {
      const response = await authFetch('/api/stripe/subscription', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        mensajePlan = data.error || 'Error al abrir portal';
        tipoMensajePlan = 'error';
      }
    } catch {
      mensajePlan = 'Error al conectar con el servidor';
      tipoMensajePlan = 'error';
    } finally {
      procesandoPortal = false;
    }
  }

  function abrirModalCambio(plan: typeof planesInfo[0]) {
    planDestino = plan;
    mostrarModalCambio = true;
    mensajePlan = '';
  }

  async function confirmarCambioPlan() {
    if (!planDestino) return;
    procesandoCambio = true;
    mensajePlan = '';
    try {
      const response = await authFetch('/api/stripe/subscription', {
        method: 'PUT',
        body: JSON.stringify({ plan: planDestino.id })
      });
      const data = await response.json();
      if (data.requiresCheckout) {
        // Suscripción cancelada: redirigir a checkout
        await iniciarCheckout(planDestino.id);
        mostrarModalCambio = false;
        planDestino = null;
        return;
      }
      if (data.success) {
        mensajePlan = `Plan cambiado exitosamente a ${planDestino.nombre}`;
        tipoMensajePlan = 'success';
        mostrarModalCambio = false;
        planDestino = null;
        suscripcion = null;
        await cargarSuscripcion();
      } else {
        mensajePlan = data.error || 'Error al cambiar de plan';
        tipoMensajePlan = 'error';
      }
    } catch {
      mensajePlan = 'Error al conectar con el servidor';
      tipoMensajePlan = 'error';
    } finally {
      procesandoCambio = false;
    }
  }

  function abrirModalCancelar() {
    mostrarModalCancelar = true;
    pasoCancelacion = 'motivo';
    motivoCancelacion = '';
    mensajePlan = '';
  }

  async function aplicarCuponRetencion() {
    procesandoCancelacion = true;
    mensajePlan = '';
    try {
      const response = await authFetch('/api/stripe/subscription', {
        method: 'DELETE',
        body: JSON.stringify({ motivo: motivoCancelacion, aplicarCupon: true })
      });
      const data = await response.json();
      if (data.retenido) {
        mensajePlan = data.mensaje || '¡Descuento aplicado! Tu suscripción continúa.';
        tipoMensajePlan = 'success';
        mostrarModalCancelar = false;
        suscripcion = null;
        await cargarSuscripcion();
      } else if (data.success) {
        mensajePlan = data.mensaje || 'Suscripción cancelada';
        tipoMensajePlan = 'success';
        mostrarModalCancelar = false;
        suscripcion = null;
        await cargarSuscripcion();
      } else {
        mensajePlan = data.error || 'Error al procesar';
        tipoMensajePlan = 'error';
      }
    } catch {
      mensajePlan = 'Error al conectar con el servidor';
      tipoMensajePlan = 'error';
    } finally {
      procesandoCancelacion = false;
    }
  }

  async function confirmarCancelacion() {
    procesandoCancelacion = true;
    mensajePlan = '';
    try {
      const response = await authFetch('/api/stripe/subscription', {
        method: 'DELETE',
        body: JSON.stringify({ motivo: motivoCancelacion, aplicarCupon: false })
      });
      const data = await response.json();
      if (data.success) {
        mensajePlan = data.mensaje || 'Tu suscripción se cancelará al final del periodo.';
        tipoMensajePlan = 'success';
        mostrarModalCancelar = false;
        suscripcion = null;
        await cargarSuscripcion();
      } else {
        mensajePlan = data.error || 'Error al cancelar';
        tipoMensajePlan = 'error';
      }
    } catch {
      mensajePlan = 'Error al conectar con el servidor';
      tipoMensajePlan = 'error';
    } finally {
      procesandoCancelacion = false;
    }
  }

  function formatearFecha(fecha: string | null): string {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  async function enviarSolicitudPersonalizado() {
    procesandoFormPersonalizado = true;
    mensajePlan = '';
    try {
      const response = await authFetch('/api/planes/solicitud-personalizado', {
        method: 'POST',
        body: JSON.stringify(formPersonalizado)
      });
      const data = await response.json();
      if (response.ok) {
        mensajePlan = 'Solicitud enviada correctamente. Nos contactaremos en breve.';
        tipoMensajePlan = 'success';
        enviadoFormPersonalizado = true;
        mostrarFormularioPersonalizado = false;
        formPersonalizado = { requiereFacturas: '', requiereClientes: '', requiereIntegraciones: '', necesidesEspeciales: '' };
        setTimeout(() => { mensajePlan = ''; enviadoFormPersonalizado = false; }, 4000);
      } else {
        mensajePlan = data.error || 'Error al enviar solicitud';
        tipoMensajePlan = 'error';
      }
    } catch {
      mensajePlan = 'Error al conectar con el servidor';
      tipoMensajePlan = 'error';
    } finally {
      procesandoFormPersonalizado = false;
    }
  }

  function nombrePlan(plan: string): string {
    const nombres: Record<string, string> = { free: 'Gratuito', basico: 'Básico', pro: 'Pro', enterprise: 'Enterprise' };
    return nombres[plan] || plan;
  }

  function colorEstado(estado: string): string {
    const colores: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      past_due: 'bg-yellow-100 text-yellow-800',
      canceled: 'bg-red-100 text-red-800',
      canceling: 'bg-orange-100 text-orange-800',
      trialing: 'bg-blue-100 text-blue-800',
    };
    return colores[estado] || 'bg-gray-100 text-gray-800';
  }

  // Cargar suscripción cuando se activa el tab de planes
  $: if (tabActivo === 'planes' && !suscripcion) {
    cargarSuscripcion();
  }

  // ═══ Datos de Facturación para Suscripción ═══
  let datosFacturacion = {
    requiereFactura: false,
    rfc: '',
    razonSocial: '',
    regimenFiscalId: 0,
    usoCFDI: 'G03',
    correo: '',
    codigoPostal: ''
  };
  let cargandoFacturacion = false;
  let guardandoFacturacion = false;
  let mensajeFacturacion = '';
  let tipoMensajeFacturacion = '';
  let facturacionCargada = false;

  const usosCFDI = [
    { codigo: 'G01', descripcion: 'Adquisición de mercancías' },
    { codigo: 'G03', descripcion: 'Gastos en general' },
    { codigo: 'D10', descripcion: 'Pagos por servicios educativos' },
    { codigo: 'S01', descripcion: 'Sin efectos fiscales' },
  ];

  async function cargarDatosFacturacion() {
    if (facturacionCargada) return;
    cargandoFacturacion = true;
    try {
      const [facturacionRes, regimenRes] = await Promise.all([
        authFetch('/api/stripe/facturacion'),
        authFetch('/api/regimen')
      ]);
      if (facturacionRes.ok) {
        const data = await facturacionRes.json();
        if (data.datos) {
          datosFacturacion = {
            requiereFactura: data.datos.requiereFactura,
            rfc: data.datos.rfc || '',
            razonSocial: data.datos.razonSocial || '',
            regimenFiscalId: data.datos.regimenFiscalId || 0,
            usoCFDI: data.datos.usoCFDI || 'G03',
            correo: data.datos.correo || '',
            codigoPostal: data.datos.codigoPostal || ''
          };
        }
      }
      if (regimenRes.ok) {
        regimenesFiscales = await regimenRes.json();
      }
      facturacionCargada = true;
    } catch (error) {
      console.error('Error cargando datos de facturación:', error);
    } finally {
      cargandoFacturacion = false;
    }
  }

  async function guardarDatosFacturacion() {
    guardandoFacturacion = true;
    mensajeFacturacion = '';
    try {
      const response = await authFetch('/api/stripe/facturacion', {
        method: 'POST',
        body: JSON.stringify(datosFacturacion)
      });
      const data = await response.json();
      if (response.ok) {
        mensajeFacturacion = data.message || 'Datos guardados correctamente';
        tipoMensajeFacturacion = 'success';
      } else {
        mensajeFacturacion = data.error || 'Error al guardar';
        tipoMensajeFacturacion = 'error';
      }
    } catch {
      mensajeFacturacion = 'Error de conexión';
      tipoMensajeFacturacion = 'error';
    } finally {
      guardandoFacturacion = false;
      setTimeout(() => { mensajeFacturacion = ''; }, 4000);
    }
  }

  // Cargar datos de facturación cuando se activa el tab de planes
  $: if (tabActivo === 'planes') {
    cargarDatosFacturacion();
  }

  async function cargarEstadoWhatsApp() {
    cargandoWhatsApp = true;
    try {
      const response = await authFetch('/api/whatsapp/connect-phone', {
        method: 'POST',
        body: JSON.stringify({ action: 'check-status' })
      });
      if (response.ok) {
        const data = await response.json();
        whatsappStatus = data.status || 'desconectado';
        whatsappTelefono = data.telefono || '';
        whatsappUltimaActividad = data.ultimaActividad || '';
      } else {
        whatsappStatus = 'desconectado';
      }
    } catch {
      whatsappStatus = 'desconectado';
    } finally {
      cargandoWhatsApp = false;
    }
  }

  // Cargar estado de WhatsApp cuando se selecciona el tab
  $: if (tabActivo === 'whatsapp') {
    cargarEstadoWhatsApp();
  }

  // Estado para API Key de FacturaAPI
  let reiniciandoApiKey = false;
  let mensajeApiKey = '';
  let tipoMensajeApiKey = '';

  // Interfaces para tipado
  interface OrganizacionDisponible {
    id: number;
    razonSocial: string;
    rfc: string;
    rolId: number;
    rolNombre: string;
  }

  interface RegimenFiscal {
    ID_Regimen: number;
    Codigo: number;
    Descripcion: string;
  }

  // Lista de organizaciones disponibles (para selector)
  let organizacionesDisponibles: OrganizacionDisponible[] = [];
  let organizacionSeleccionada = '';

  // Lista de regímenes fiscales
  let regimenesFiscales: RegimenFiscal[] = [];

  // Función para cambiar de organización
  async function cambiarOrganizacion() {
    if (organizacionSeleccionada) {
      cargando = true;
      await cargarDatosOrganizacion(organizacionSeleccionada);
      cargando = false;
      mostrarMensaje('Organización cambiada exitosamente', 'success');
    }
  }

  // Datos de la organización
  let datosOrganizacion = {
    razonSocial: '',
    rfc: '',
    nombre: '',
    correoElectronico: '',
    telefono: '',
    direccion: {
      calle: '',
      numeroExterior: '',
      numeroInterior: '',
      colonia: '',
      ciudad: '',
      estado: '',
      codigoPostal: '',
      pais: 'México'
    },
    datosFiscales: {
      regimenFiscal: ''
    },
    tieneCertificados: false
  };

  // Configuración de cobranza
  let configCobranza = {
    diasGracia: 3,
    escalonamiento: {
      primer_recordatorio: 7,  // 7 días después del vencimiento
      segundo_recordatorio: 15, // 15 días después
      gestion_telefonica: 30,   // 30 días después
      proceso_legal: 90         // 90 días después
    },
    envioAutomaticoRecordatorios: true,
    diasRecordatorioPrevio: 3,
    horariosEnvio: {
      horaInicio: '09:00',
      horaFin: '18:00',
      diasSemana: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes']
    }
  };

  // Configuración de plantillas de email (manejadas en backend)
  let configEmail = {
    plantillas: {
      recordatorio_pago: {
        asunto: 'Recordatorio de Pago - Factura #{numero_factura}',
        cuerpo: `
Estimado/a {nombre_cliente},

Esperamos que se encuentre bien. Le recordamos que tiene una factura pendiente de pago:

📄 Factura: {numero_factura}
💰 Monto: {monto_total}
📅 Fecha de vencimiento: {fecha_vencimiento}
⏰ Días vencida: {dias_vencido}

Le solicitamos realizar el pago a la brevedad posible para evitar cargos adicionales.

Gracias por su atención.

Atentamente,
{nombre_empresa}
        `
      },
      segunda_notificacion: {
        asunto: 'URGENTE - Pago Vencido - Factura #{numero_factura}',
        cuerpo: `
Estimado/a {nombre_cliente},

Su factura #{numero_factura} continúa pendiente de pago.

💰 Monto adeudado: {monto_pendiente}
⏰ Días vencida: {dias_vencido}

Es importante que regularice su situación para mantener nuestros servicios activos.

Por favor, contacte con nosotros para coordinar el pago.

Atentamente,
{nombre_empresa}
Teléfono: {telefono_empresa}
        `
      }
    }
  };

  onMount(async () => {
    // Si viene ?tab=plan desde redirect de Stripe, abrir tab de planes
    const tabParam = $page.url.searchParams.get('tab');
    if (tabParam === 'plan' || tabParam === 'planes') {
      tabActivo = 'planes';
    }
    await cargarConfiguracion();
  });

  async function cargarConfiguracion() {
    cargando = true;
    try {
      // Cargar datos de la organización actual
      const user = $page.data.user;
      if (user) {
        const { authFetch } = await import('$lib/api');

        // Cargar lista de organizaciones del usuario
        const orgListResponse = await authFetch(`/api/usuario/${user.id}/organizaciones`);
        if (orgListResponse.ok) {
          const orgListData = await orgListResponse.json();
          if (orgListData.success) {
            organizacionesDisponibles = orgListData.organizaciones;
          }
        }

        // Cargar regímenes fiscales
        const regimenResponse = await authFetch('/api/regimen');
        if (regimenResponse.ok) {
          regimenesFiscales = await regimenResponse.json();
        }

        // Obtener información de la organización actual
        const orgResponse = await authFetch(`/api/usuario/${user.id}/organizacion`);
        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          organizacionActual = orgData;
          organizacionSeleccionada = orgData.organizacionId || '';

          // Cargar datos de configuración de la organización seleccionada
          await cargarDatosOrganizacion(organizacionSeleccionada);
        }
      }
    } catch (error) {
      mostrarMensaje('Error al cargar la configuración', 'error');
    } finally {
      cargando = false;
    }
  }

  async function cargarDatosOrganizacion(organizacionId: string) {
    if (!organizacionId) return;

    try {
      const { authFetch } = await import('$lib/api');
      // Cargar configuración completa desde la API
      const response = await authFetch(`/api/configuracion/organizacion/${organizacionId}`);

      if (response.ok) {
        const data = await response.json();

          if (data.success) {
          if (data.configuracion) {
            // Cargar datos de organización desde BD
            datosOrganizacion.razonSocial = data.configuracion.razonSocial;
            datosOrganizacion.rfc = data.configuracion.rfc;
            datosOrganizacion.nombre = data.configuracion.nombreComercial || data.configuracion.razonSocial;
            datosOrganizacion.correoElectronico = data.configuracion.emailCorporativo || '';
            datosOrganizacion.telefono = data.configuracion.telefono || '';

            // Cargar dirección
            datosOrganizacion.direccion = {
              calle: data.configuracion.direccion.calle || '',
              numeroExterior: data.configuracion.direccion.numeroExterior || '',
              numeroInterior: data.configuracion.direccion.numeroInterior || '',
              colonia: data.configuracion.direccion.colonia || '',
              ciudad: data.configuracion.direccion.ciudad || '',
              estado: data.configuracion.direccion.estado || '',
              codigoPostal: data.configuracion.direccion.codigoPostal || '',
              pais: data.configuracion.direccion.pais || 'México'
            };

            // Cargar datos fiscales
            datosOrganizacion.datosFiscales = {
              regimenFiscal: data.configuracion.datosFiscales.regimenFiscal || ''
            };

            datosOrganizacion.tieneCertificados = !!data.configuracion.tieneCertificados;
          } else {
            // Si no hay configuración guardada, usar datos básicos de la organización
            const orgSeleccionada = organizacionesDisponibles.find(org => org.id.toString() === organizacionId);
            if (orgSeleccionada) {
              datosOrganizacion.razonSocial = orgSeleccionada.razonSocial;
              datosOrganizacion.rfc = orgSeleccionada.rfc;
              datosOrganizacion.nombre = orgSeleccionada.razonSocial;
              datosOrganizacion.correoElectronico = '';
              datosOrganizacion.telefono = '';

              // Restablecer campos vacíos
              datosOrganizacion.direccion = {
                calle: '',
                numeroExterior: '',
                numeroInterior: '',
                colonia: '',
                ciudad: '',
                estado: '',
                codigoPostal: '',
                pais: 'México'
              };

              datosOrganizacion.datosFiscales = {
                regimenFiscal: ''
              };

              datosOrganizacion.tieneCertificados = false;
            }
          }

          // Cargar configuración de cobranza
          if (data.configCobranza) {
            configCobranza = {
              diasGracia: data.configCobranza.diasGracia,
              escalonamiento: data.configCobranza.escalonamiento,
              envioAutomaticoRecordatorios: data.configCobranza.envioAutomaticoRecordatorios,
              diasRecordatorioPrevio: data.configCobranza.diasRecordatorioPrevio,
              horariosEnvio: data.configCobranza.horariosEnvio
            };
          } else {
            // Restablecer configuración por defecto
            configCobranza = {
              diasGracia: 3,
              escalonamiento: {
                primer_recordatorio: 7,
                segundo_recordatorio: 15,
                gestion_telefonica: 30,
                proceso_legal: 90
              },
              envioAutomaticoRecordatorios: true,
              diasRecordatorioPrevio: 3,
              horariosEnvio: {
                horaInicio: '09:00',
                horaFin: '18:00',
                diasSemana: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes']
              }
            };
          }
        }
      } else {
        mostrarMensaje('Error al cargar la configuración de la organización', 'error');
      }

    // Intentar cargar personalización de Facturapi (branding / folios / pdf_extra)
    try {
      const customResponse = await authFetch(`/api/organizaciones/${organizacionId}/customization`);
      if (customResponse.ok) {
        const customData = await customResponse.json();
        if (customData.success && customData.customization) {
          const rawColor = customData.customization.color || '';
          customizacion.color = rawColor ? `#${rawColor.replace(/^#/, '')}` : '';
          customizacion.nextFolioNumber = customData.customization.next_folio_number != null
            ? String(customData.customization.next_folio_number)
            : '';
          const pdfExtra = customData.customization.pdf_extra || {};
          customizacion.pdfExtraCodes = Boolean(pdfExtra.codes);
          customizacion.pdfExtraProductKey = Boolean(pdfExtra.product_key);
          customizacion.hasLogo = Boolean(customData.customization.has_logo);
        }
      } else {
        console.error('No se pudo cargar la personalización de Facturapi');
      }
    } catch (customErr) {
      console.error('Error al cargar la personalización de Facturapi:', customErr);
    }
    } catch (error) {
      mostrarMensaje('Error al conectar con el servidor', 'error');
    }
  }

  async function guardarConfiguracion() {
    guardando = true;

    if (!organizacionSeleccionada) {
      mostrarMensaje('Debe seleccionar una organización', 'error');
      guardando = false;
      return;
    }

    try {
      // Preparar datos para enviar
      const datosParaGuardar = {
        razonSocial: datosOrganizacion.razonSocial,
        rfc: datosOrganizacion.rfc,
        nombreComercial: datosOrganizacion.nombre,
        emailCorporativo: datosOrganizacion.correoElectronico,
        telefono: datosOrganizacion.telefono,
        direccion: datosOrganizacion.direccion,
        datosFiscales: datosOrganizacion.datosFiscales,
        configCobranza: configCobranza,
        activa: true
      };

      // Llamar a la API para guardar
      const { authFetch } = await import('$lib/api');
      const response = await authFetch(`/api/configuracion/organizacion/${organizacionSeleccionada}`, {
        method: 'POST',
        body: JSON.stringify(datosParaGuardar)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        mostrarMensaje('Configuración guardada exitosamente', 'success');
      } else {
        mostrarMensaje(result.error || 'Error al guardar la configuración', 'error');
      }
    } catch (error) {
      mostrarMensaje('Error al conectar con el servidor', 'error');
    } finally {
      guardando = false;
    }
  }

  async function eliminarOrganizacion() {
    eliminando = true;
    mostrarConfirmacionEliminar = false;

    if (!organizacionSeleccionada) {
      mostrarMensaje('Debe seleccionar una organización', 'error');
      eliminando = false;
      return;
    }

    try {
      const { authFetch } = await import('$lib/api');
      const response = await authFetch(`/api/organizaciones/${organizacionSeleccionada}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (response.ok && result.success) {
        mostrarMensaje('Organización eliminada correctamente', 'success');
        
        // Recargar la página después de mostrar el mensaje de éxito
        setTimeout(() => {
          location.reload();
        }, 2000);
      } else {
		const detalle = extraerMensajeDetallado(result);
		const mensajeBase = result.error || 'Error al eliminar la organización';
		mostrarMensaje(detalle ? `${mensajeBase}: ${detalle}` : mensajeBase, 'error');
      }
    } catch (error) {
      mostrarMensaje('Error al conectar con el servidor', 'error');
    } finally {
      eliminando = false;
    }
  }

  function mostrarMensaje(texto: string, tipo: 'success' | 'error') {
    mensaje = texto;
    tipoMensaje = tipo;
    setTimeout(() => {
      mensaje = '';
      tipoMensaje = '';
    }, 5000);
  }

  function mostrarMensajeLocal(tipo: 'logo' | 'personalizacion', texto: string, estado: 'success' | 'error') {
    if (tipo === 'logo') {
      mensajeLogo = texto;
      tipoMensajeLogo = estado;
      setTimeout(() => {
        mensajeLogo = '';
        tipoMensajeLogo = '';
      }, 5000);
    } else if (tipo === 'personalizacion') {
      mensajePersonalizacion = texto;
      tipoMensajePersonalizacion = estado;
      setTimeout(() => {
        mensajePersonalizacion = '';
        tipoMensajePersonalizacion = '';
      }, 5000);
    }
  }

  function extraerMensajeDetallado(result: any): string | null {
    if (!result || !result.details) return null;

    const details = result.details;

    if (typeof details === 'string') {
      try {
        const parsed = JSON.parse(details);
        if (parsed && typeof parsed.message === 'string') {
          return parsed.message;
        }
      } catch (e) {
        return null;
      }
      return null;
    }

    if (typeof details === 'object') {
      if (typeof details.message === 'string') {
        return details.message;
      }
      if (typeof details.error === 'string') {
        return details.error;
      }
    }

    return null;
  }

  function onLogoSelected(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files && target.files[0] ? target.files[0] : null;
    logoFile = file;

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
      logoPreviewUrl = null;
    }

    if (file) {
      logoPreviewUrl = URL.createObjectURL(file);
    }
  }

  async function subirLogo() {
    if (!organizacionSeleccionada) {
      mostrarMensajeLocal('logo', 'Debe seleccionar una organización', 'error');
      return;
    }

    if (!logoFile) {
      mostrarMensajeLocal('logo', 'Debes seleccionar un archivo de imagen para el logotipo', 'error');
      return;
    }

    try {
      subiendoLogo = true;
      const formData = new FormData();
      formData.append('file', logoFile);

      const { authFetch } = await import('$lib/api');
      const response = await authFetch(`/api/organizaciones/${organizacionSeleccionada}/logo`, {
        method: 'PUT',
        body: formData
      });

      const result = await response.json();

      if (response.ok && result.success) {
        mostrarMensajeLocal('logo', 'Logotipo actualizado correctamente', 'success');
        // Recargar customization para actualizar hasLogo
        if (organizacionSeleccionada) {
          await cargarDatosOrganizacion(organizacionSeleccionada);
        }
      } else {
        const detalle = extraerMensajeDetallado(result);
        const mensajeBase = result.error || 'Error al subir el logotipo';
        mostrarMensajeLocal('logo', detalle ? `${mensajeBase}: ${detalle}` : mensajeBase, 'error');
      }
    } catch (error) {
      mostrarMensajeLocal('logo', 'Error al conectar con el servidor', 'error');
    } finally {
      subiendoLogo = false;
    }
  }

  async function guardarCustomizacion() {
    if (!organizacionSeleccionada) {
      mostrarMensajeLocal('personalizacion', 'Debe seleccionar una organización', 'error');
      return;
    }

    guardandoCustomizacion = true;

    const payload: any = {
      next_folio_number: customizacion.nextFolioNumber || undefined,
      pdf_extra: {
        codes: customizacion.pdfExtraCodes,
        product_key: customizacion.pdfExtraProductKey
      }
    };

    const colorValueRaw = (customizacion.color || '').trim();
    const colorValue = colorValueRaw.replace(/^#/, '');
    if (colorValue) {
      payload.color = colorValue;
    }

    try {
      const { authFetch } = await import('$lib/api');
      const response = await authFetch(`/api/organizaciones/${organizacionSeleccionada}/customization`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        mostrarMensajeLocal('personalizacion', 'Personalización actualizada correctamente', 'success');
      } else {
        const detalle = extraerMensajeDetallado(result);
        const mensajeBase = result.error || 'Error al actualizar la personalización';
        mostrarMensajeLocal('personalizacion', detalle ? `${mensajeBase}: ${detalle}` : mensajeBase, 'error');
      }
    } catch (error) {
      mostrarMensajeLocal('personalizacion', 'Error al conectar con el servidor', 'error');
    } finally {
      guardandoCustomizacion = false;
    }
  }

  // Guardar datos fiscales a Facturapi
  async function guardarDatosFiscales() {
    guardando = true;

    if (!organizacionSeleccionada) {
      mostrarMensaje('Debe seleccionar una organización', 'error');
      guardando = false;
      return;
    }

    try {
      const datosParaActualizar = {
        name: datosOrganizacion.nombre,
        legal_name: datosOrganizacion.razonSocial,
        razonSocial: datosOrganizacion.razonSocial,
        nombreComercial: datosOrganizacion.nombre,
        // Enviamos el ID_Regimen; el backend lo convertirá a Código SAT para Facturapi
        regimenFiscal: datosOrganizacion.datosFiscales.regimenFiscal,
        address: datosOrganizacion.direccion,
        support_email: datosOrganizacion.correoElectronico,
        emailCorporativo: datosOrganizacion.correoElectronico,
        phone: datosOrganizacion.telefono,
        telefono: datosOrganizacion.telefono
      };

      const { authFetch } = await import('$lib/api');
      const response = await authFetch(`/api/organizaciones/${organizacionSeleccionada}`, {
        method: 'PUT',
        body: JSON.stringify(datosParaActualizar)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        mostrarMensaje('Datos fiscales actualizados exitosamente', 'success');
      } else {
        const detalle = extraerMensajeDetallado(result);
        const mensajeBase = result.error || 'Error al actualizar los datos fiscales';
        mostrarMensaje(detalle ? `${mensajeBase}: ${detalle}` : mensajeBase, 'error');
      }
    } catch (error) {
      mostrarMensaje('Error al conectar con el servidor', 'error');
    } finally {
      guardando = false;
    }
  }

  // Eliminar certificados CSD
  async function eliminarCertificados() {
    eliminarCertCargando = true;
    mostrarConfirmacionEliminarCert = false;

    if (!organizacionSeleccionada) {
      mostrarMensaje('Debe seleccionar una organización', 'error');
      eliminarCertCargando = false;
      return;
    }

    try {
      const { authFetch } = await import('$lib/api');
      const response = await authFetch(`/api/organizaciones/${organizacionSeleccionada}/certificate`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (response.ok && result.success) {
        mostrarMensaje('Certificados eliminados correctamente. ' + result.message, 'success');
      } else {
        const detalle = extraerMensajeDetallado(result);
        const mensajeBase = result.error || 'Error al eliminar los certificados';
        mostrarMensaje(detalle ? `${mensajeBase}: ${detalle}` : mensajeBase, 'error');
      }
    } catch (error) {
      mostrarMensaje('Error al conectar con el servidor', 'error');
    } finally {
      eliminarCertCargando = false;
    }
  }

  // Reiniciar API Key de FacturaAPI
  async function reiniciarApiKeyFacturaAPI() {
    reiniciandoApiKey = true;
    mensajeApiKey = '';
    tipoMensajeApiKey = '';

    if (!organizacionSeleccionada) {
      mensajeApiKey = 'Debe seleccionar una organización';
      tipoMensajeApiKey = 'error';
      reiniciandoApiKey = false;
      return;
    }

    try {
      const { authFetch } = await import('$lib/api');
      const response = await authFetch('/api/organizaciones/reiniciar-api-key', {
        method: 'POST',
        body: JSON.stringify({ organizacionId: parseInt(organizacionSeleccionada) })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        mensajeApiKey = 'API Key de FacturaAPI reiniciada correctamente. La nueva clave fue guardada en la base de datos.';
        tipoMensajeApiKey = 'success';
      } else {
        const mensajeError = result.error || result.detalles || 'Error al reiniciar la API Key';
        mensajeApiKey = mensajeError;
        tipoMensajeApiKey = 'error';
      }
    } catch (error) {
      mensajeApiKey = 'Error al conectar con el servidor';
      tipoMensajeApiKey = 'error';
      console.error('Error reiniciando API Key:', error);
    } finally {
      reiniciandoApiKey = false;
    }
  }

  // Subir / reemplazar certificados CSD
  let archivoCer: File | null = null;
  let archivoKey: File | null = null;
  let passwordCert = '';
  let subiendoCert = false;

  function onCerSelected(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    archivoCer = target.files && target.files[0] ? target.files[0] : null;
  }

  function onKeySelected(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    archivoKey = target.files && target.files[0] ? target.files[0] : null;
  }

  async function subirCertificados() {
    if (!organizacionSeleccionada) {
      mostrarMensaje('Debe seleccionar una organización', 'error');
      return;
    }

    if (!archivoCer || !archivoKey || !passwordCert.trim()) {
      mostrarMensaje('Debes seleccionar archivos .cer, .key y capturar la contraseña', 'error');
      return;
    }

    try {
      subiendoCert = true;
      const formData = new FormData();
      formData.append('cer', archivoCer);
      formData.append('key', archivoKey);
      formData.append('password', passwordCert.trim());
      formData.append('organizacion_id', organizacionSeleccionada);

      const { authFetch } = await import('$lib/api');
      const response = await authFetch('/api/organizaciones/subir-certificado', {
        method: 'PUT',
        body: formData
      });

      const result = await response.json();

      if (response.ok && result.success) {
        mostrarMensaje('Certificados CSD subidos correctamente', 'success');
        datosOrganizacion.tieneCertificados = true;
      } else {
        const detalle = extraerMensajeDetallado(result);
        const mensajeBase = result.error || 'Error al subir los certificados';
        mostrarMensaje(detalle ? `${mensajeBase}: ${detalle}` : mensajeBase, 'error');
      }
    } catch (error) {
      mostrarMensaje('Error al conectar con el servidor', 'error');
    } finally {
      subiendoCert = false;
    }
  }

</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
    <div class="mb-4">
      <p class="text-sm text-gray-600">Gestiona la configuración de tu organización</p>
    </div>

    <!-- Selector de Organización -->
    <div class="mb-6">
      <div class="flex items-center space-x-4">
        <div class="flex-1">
          <label for="organizacion-select" class="block text-sm font-medium text-gray-700 mb-2">Organización Activa</label>
          <div class="flex items-center space-x-3">
            <div class="flex-1">
              <select
                id="organizacion-select"
                bind:value={organizacionSeleccionada}
                on:change={cambiarOrganizacion}
                disabled={cargando || organizacionesDisponibles.length === 0}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Seleccionar organización...</option>
                {#each organizacionesDisponibles as org}
                  <option value={org.id}>{org.razonSocial} ({org.rfc})</option>
                {/each}
              </select>
              {#if organizacionesDisponibles.length === 0 && !cargando}
                <p class="text-sm text-gray-500 mt-1">No se encontraron organizaciones</p>
              {/if}
            </div>
            <div class="flex items-center text-sm text-gray-600">
              {#if organizacionesDisponibles.length > 0}
                <Users class="w-4 h-4 mr-1" />
                {organizacionesDisponibles.length} organización{organizacionesDisponibles.length > 1 ? 'es' : ''}
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mensaje de estado -->
    {#if mensaje}
      <div class="mt-4 p-3 rounded-lg {tipoMensaje === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}">
        {mensaje}
      </div>
    {/if}
  </div>

  {#if cargando}
    <!-- Loading state -->
    <div class="text-center py-12">
      <RefreshCw class="w-8 h-8 mx-auto text-gray-400 animate-spin mb-4" />
      <p class="text-gray-600">Cargando configuración...</p>
    </div>
  {:else}
    <!-- Tabs de configuración -->
    <div class="bg-white rounded-xl shadow-sm border">
      <!-- Tab headers -->
      <div class="border-b border-gray-200 px-6">
        <nav class="-mb-px flex space-x-8 overflow-x-auto px-6">
          <button
            on:click={() => tabActivo = 'organizacion'}
            class="py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors {tabActivo === 'organizacion' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          >
            <Building2 class="w-4 h-4 inline mr-2" />
            Organización
          </button>
          <button
            on:click={() => tabActivo = 'certificados'}
            class="py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors {tabActivo === 'certificados' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          >
            <FileText class="w-4 h-4 inline mr-2" />
            Certificados
          </button>
          <button
            on:click={() => tabActivo = 'planes'}
            class="py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors {tabActivo === 'planes' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          >
            <CreditCard class="w-4 h-4 inline mr-2" />
            Plan
          </button>
          <button
            on:click={() => tabActivo = 'integraciones'}
            class="py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors {tabActivo === 'integraciones' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          >
            <Zap class="w-4 h-4 inline mr-2" />
            Integraciones
          </button>
          <button
            on:click={() => tabActivo = 'whatsapp'}
            class="py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors {tabActivo === 'whatsapp' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          >
            <Smartphone class="w-4 h-4 inline mr-2" />
            WhatsApp
          </button>
          <button
            on:click={() => tabActivo = 'cuenta'}
            class="py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors {tabActivo === 'cuenta' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          >
            <User class="w-4 h-4 inline mr-2" />
            Cuenta
          </button>
        </nav>
      </div>

      <!-- Tab content -->
      <div class="p-6">
        {#if tabActivo === 'organizacion'}
          <!-- Datos de la Organización -->
          <div class="space-y-6">
            <div>
              <h2 class="text-lg font-semibold text-gray-900 mb-4">Información de la Empresa</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  id="razon-social"
                  type="text"
                  bind:value={datosOrganizacion.razonSocial}
                  label="Razón Social"
                  placeholder="Mi Empresa S.A. de C.V."
                  required
                />
                <div>
                  <Input
                    id="rfc"
                    type="text"
                    bind:value={datosOrganizacion.rfc}
                    label="RFC"
                    placeholder="ABC123456789"
                    required
                  />
                  <p class="text-xs text-blue-600 mt-2 flex items-center gap-1">
                    El RFC debe coincidir exactamente con el de tus certificados CSD
                  </p>
                </div>
                <Input
                  id="nombre-comercial"
                  type="text"
                  bind:value={datosOrganizacion.nombre}
                  label="Nombre Comercial"
                  placeholder="Mi Empresa"
                />
                <Input
                  id="email-corporativo"
                  type="email"
                  bind:value={datosOrganizacion.correoElectronico}
                  label="Email Corporativo"
                  placeholder="contacto@miempresa.com"
                />
                <Input
                  id="telefono"
                  type="tel"
                  bind:value={datosOrganizacion.telefono}
                  label="Teléfono"
                  placeholder="+52 55 1234 5678"
                />
              </div>
            </div>

            <!-- Dirección -->
            <div class="border-t pt-6">
              <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin class="w-5 h-5 mr-2 text-green-600" />
                Dirección Fiscal
              </h2>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Input
                  id="calle"
                  type="text"
                  bind:value={datosOrganizacion.direccion.calle}
                  label="Calle"
                  placeholder="Av. Reforma"
                />
                <Input
                  id="numero-exterior"
                  type="text"
                  bind:value={datosOrganizacion.direccion.numeroExterior}
                  label="No. Exterior"
                  placeholder="123"
                />
                <Input
                  id="numero-interior"
                  type="text"
                  bind:value={datosOrganizacion.direccion.numeroInterior}
                  label="No. Interior"
                  placeholder="A"
                />
                <Input
                  id="colonia"
                  type="text"
                  bind:value={datosOrganizacion.direccion.colonia}
                  label="Colonia"
                  placeholder="Centro"
                />
                <Input
                  id="ciudad"
                  type="text"
                  bind:value={datosOrganizacion.direccion.ciudad}
                  label="Ciudad"
                  placeholder="Ciudad de México"
                />
                <Input
                  id="estado"
                  type="text"
                  bind:value={datosOrganizacion.direccion.estado}
                  label="Estado"
                  placeholder="CDMX"
                />
                <Input
                  id="codigo-postal"
                  type="text"
                  bind:value={datosOrganizacion.direccion.codigoPostal}
                  label="Código Postal"
                  placeholder="01000"
                />
                <Input
                  id="pais"
                  type="text"
                  bind:value={datosOrganizacion.direccion.pais}
                  label="País"
                  placeholder="México"
                />
              </div>
            </div>

            <!-- Datos Fiscales -->
            <div class="border-t pt-6">
              <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CreditCard class="w-5 h-5 mr-2 text-blue-600" />
                Información Fiscal
              </h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label for="regimen-fiscal" class="block text-sm font-medium text-gray-700 mb-2">Régimen Fiscal</label>
                  <select
                    id="regimen-fiscal"
                    bind:value={datosOrganizacion.datosFiscales.regimenFiscal}
                    disabled={cargando || regimenesFiscales.length === 0}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Seleccionar régimen fiscal...</option>
                    {#each regimenesFiscales as regimen}
                      <option value={regimen.ID_Regimen}>
                        {regimen.Codigo} - {regimen.Descripcion}
                      </option>
                    {/each}
                  </select>
                  {#if regimenesFiscales.length === 0 && !cargando}
                    <p class="text-sm text-gray-500 mt-1">No se pudieron cargar los regímenes fiscales</p>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Branding: Logotipo y Personalización -->
            <div class="border-t pt-6 space-y-6">
              <div>
                <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Palette class="w-5 h-5 mr-2 text-purple-600" />
                  Identidad visual y folios
                </h2>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <!-- Subir logotipo -->
                  <div class="border border-gray-200 rounded-lg p-4">
                    <h3 class="text-md font-semibold text-gray-900 mb-2">Logotipo de la organización</h3>
                    <p class="text-sm text-gray-600 mb-2">
                      El logotipo se usará en los PDFs y correos generados por nuestro proveedor de timbrado. Formatos soportados: JPG, PNG, SVG. Tamaño máximo 500 KB.
                    </p>
                    {#if customizacion.hasLogo}
                      <p class="text-xs text-green-700 mb-4">
                        ✓ Ya tienes un logotipo configurado. Si subes uno nuevo, se reemplazará el actual.
                      </p>
                    {:else}
                      <p class="text-xs text-gray-600 mb-4">
                        Actualmente esta organización no tiene un logotipo configurado.
                      </p>
                    {/if}
                    <input
                      id="logo-file"
                      type="file"
                      accept="image/png, image/jpeg, image/svg+xml"
                      class="hidden"
                      on:change={onLogoSelected}
                    />
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <button
                        type="button"
                        on:click={() => document.getElementById('logo-file')?.click()}
                        class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                      >
                        Seleccionar logotipo
                      </button>
                      <div class="text-sm text-gray-700">
                        {#if logoFile}
                          Archivo seleccionado: <strong>{logoFile.name}</strong>
                        {:else}
                          Ningún archivo seleccionado
                        {/if}
                      </div>
                    </div>
                    {#if logoPreviewUrl}
                      <div class="mt-4 flex flex-col items-center gap-2">
                        <p class="text-xs text-gray-500">Previsualización del logotipo seleccionado:</p>
                        <img
                          src={logoPreviewUrl}
                          alt="Logotipo seleccionado"
                          class="h-16 max-w-full object-contain border border-gray-200 rounded-md bg-white"
                        />
                      </div>
                    {/if}
                    <div class="mt-4 space-y-2">
                      <div class="flex justify-end">
                        <button
                          type="button"
                          on:click={subirLogo}
                          disabled={subiendoLogo || cargando || !organizacionSeleccionada}
                          class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
                        >
                          <Save class="w-4 h-4" />
                          {subiendoLogo ? 'Subiendo...' : 'Guardar logotipo'}
                        </button>
                      </div>
                      {#if mensajeLogo}
                        <div class="p-3 rounded-lg text-sm {tipoMensajeLogo === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}">
                          {mensajeLogo}
                        </div>
                      {/if}
                    </div>
                  </div>

                  <!-- Personalización de facturación -->
                  <div class="border border-gray-200 rounded-lg p-4">
                    <h3 class="text-md font-semibold text-gray-900 mb-2">Personalización de facturación</h3>
                    <p class="text-sm text-gray-600 mb-4">
                      Configura el color de la marca y algunos detalles opcionales del PDF que se envía a tus clientes.
                    </p>
                    <div class="space-y-4">
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <label for="color-marca" class="block text-sm font-medium text-gray-700 mb-1">Color de la marca (HEX)</label>
                                    <div class="flex items-center gap-3">
                                      <input
                                        id="color-marca"
                                        type="text"
                                        bind:value={customizacion.color}
                                        placeholder="#BADA55"
                                        class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                      />
                                      <input
                                        type="color"
                                        bind:value={customizacion.color}
                                        class="w-10 h-10 border border-gray-300 rounded-md p-0"
                                      />
                                    </div>
                                  </div>
                        <div>
                          <label for="next-folio" class="block text-sm font-medium text-gray-700 mb-1">Siguiente folio</label>
                          <input
                            id="next-folio"
                            type="number"
                            min="1"
                            bind:value={customizacion.nextFolioNumber}
                            placeholder="Opcional"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                          />
                        </div>
                      </div>

                      <div class="border-t pt-4 mt-2">
                        <p class="text-sm font-medium text-gray-800 mb-2">Campos extra en PDF</p>
                        <div class="space-y-2 text-sm text-gray-700">
                          <label class="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              bind:checked={customizacion.pdfExtraCodes}
                              class="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            Mostrar códigos de productos (codes)
                          </label>
                          <label class="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              bind:checked={customizacion.pdfExtraProductKey}
                              class="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            Mostrar clave de producto SAT (product_key)
                          </label>
                        </div>
                      </div>

                      <div class="mt-4 space-y-2">
                        <div class="flex justify-end border-t pt-4">
                          <button
                            type="button"
                            on:click={guardarCustomizacion}
                            disabled={guardandoCustomizacion || cargando || !organizacionSeleccionada}
                            class="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
                          >
                            <Save class="w-4 h-4" />
                            {guardandoCustomizacion ? 'Guardando...' : 'Guardar personalización'}
                          </button>
                        </div>
                        {#if mensajePersonalizacion}
                          <div class="p-3 rounded-lg text-sm {tipoMensajePersonalizacion === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}">
                            {mensajePersonalizacion}
                          </div>
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Botones de Acción -->
            <div class="border-t pt-6 flex justify-between">
              <button
                on:click={() => mostrarConfirmacionEliminar = true}
                disabled={eliminando || cargando || !organizacionSeleccionada}
                class="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Trash2 class="w-5 h-5" />
                {eliminando ? 'Eliminando...' : 'Eliminar'}
              </button>
              <Button
                variant="primary"
                size="lg"
                on:click={guardarDatosFiscales}
                disabled={guardando || cargando}
                loading={guardando}
              >
                <Save class="w-5 h-5 mr-2" />
                {guardando ? '' : 'Guardar Cambios'}
              </Button>
            </div>
          </div>

        {:else if tabActivo === 'certificados'}
          <!-- Gestión de Certificados CSD -->
          <div class="space-y-6">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h2 class="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                <FileText class="w-5 h-5 mr-2 text-blue-600" />
                Certificados CSD (e.firma)
              </h2>
              {#if datosOrganizacion.tieneCertificados}
                <p class="text-gray-700 mb-2">
                  Esta organización ya tiene certificados CSD configurados en el PAC.
                </p>
                <p class="text-sm text-gray-600">
                  Puedes reemplazarlos subiendo nuevos archivos o eliminarlos por completo si ya no deseas emitir facturas desde esta organización.
                </p>
              {:else}
                <p class="text-gray-700 mb-2">
                  Aún no has cargado certificados CSD para esta organización.
                </p>
                <p class="text-sm text-gray-600">
                  Los certificados CSD (.cer y .key) son requeridos para la emisión de facturas electrónicas. Cárgalos de manera segura aquí.
                </p>
              {/if}
            </div>

            <div class="border border-gray-200 rounded-lg p-6">
              <h3 class="text-md font-semibold text-gray-900 mb-4">
                {datosOrganizacion.tieneCertificados ? 'Reemplazar Certificados' : 'Cargar Certificados'}
              </h3>
              <div class="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
                <FileText class="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p class="text-gray-700 font-medium mb-2">Selecciona tus archivos de certificado</p>
                <p class="text-sm text-gray-600 mb-4">Necesitas un archivo .cer y un archivo .key</p>
                <input
                  type="file"
                  id="cert-cer"
                  accept=".cer"
                  class="hidden"
                  on:change={onCerSelected}
                />
                <input
                  type="file"
                  id="cert-key"
                  accept=".key"
                  class="hidden"
                  on:change={onKeySelected}
                />
                <div class="flex gap-3 justify-center">
                  <button
                    on:click={() => document.getElementById('cert-cer')?.click()}
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Seleccionar .cer
                  </button>
                  <button
                    on:click={() => document.getElementById('cert-key')?.click()}
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Seleccionar .key
                  </button>
                </div>
                <div class="mt-4 text-sm text-gray-700 flex flex-col items-center gap-1">
                  {#if archivoCer}
                    <span>CER seleccionado: <strong>{archivoCer.name}</strong></span>
                  {/if}
                  {#if archivoKey}
                    <span>KEY seleccionada: <strong>{archivoKey.name}</strong></span>
                  {/if}
                </div>
              </div>
              
              <div class="mt-4">
                <label for="cert-password" class="block text-sm font-medium text-gray-700 mb-2">Contraseña del certificado</label>
                <input
                  id="cert-password"
                  type="password"
                  bind:value={passwordCert}
                  placeholder="Contraseña del archivo .key"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                <p class="text-sm text-yellow-800">
                  <strong>Nota importante:</strong> Los certificados se suben directamente al PAC autorizado y se validan automáticamente. Solo almacenamos hashes para evitar duplicados.
                </p>
              </div>

              <div class="flex items-center justify-between border-t pt-6 mt-4">
                <button
                  on:click={subirCertificados}
                  disabled={subiendoCert || cargando || !organizacionSeleccionada}
                  class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Save class="w-5 h-5" />
                  {subiendoCert ? 'Subiendo...' : datosOrganizacion.tieneCertificados ? 'Reemplazar Certificados' : 'Subir Certificados'}
                </button>

                {#if datosOrganizacion.tieneCertificados}
                  <div class="text-right">
                    <button
                      on:click={() => mostrarConfirmacionEliminarCert = true}
                      disabled={eliminarCertCargando || cargando || !organizacionSeleccionada}
                      class="px-4 py-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      <Trash2 class="w-5 h-5" />
                      {eliminarCertCargando ? 'Eliminando...' : 'Eliminar Certificados'}
                    </button>
                    <p class="text-xs text-gray-600 mt-2">
                      Esto eliminará los certificados CSD del PAC. No podrás emitir nuevas facturas hasta que subas nuevos certificados.
                    </p>
                  </div>
                {/if}
              </div>
            </div>
          </div>

        {:else if tabActivo === 'planes'}
          <!-- Suscripción y Planes -->
          <div class="space-y-6">
            {#if cargandoSuscripcion}
              <div class="text-center py-12">
                <RefreshCw class="w-8 h-8 mx-auto text-gray-400 animate-spin mb-4" />
                <p class="text-gray-600">Cargando información del plan...</p>
              </div>
            {:else if suscripcion}
              <!-- Plan actual -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wide">Plan Actual</h3>
                    <Crown class="w-5 h-5 text-green-600" />
                  </div>
                  <p class="text-2xl font-bold text-green-700">{nombrePlan(suscripcion.plan)}</p>
                  <span class="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium {colorEstado(suscripcion.estado)}">
                    {suscripcion.estado === 'active' ? 'Activo' : suscripcion.estado === 'past_due' ? 'Pago pendiente' : suscripcion.estado === 'canceled' ? 'Cancelado' : suscripcion.estado === 'canceling' ? 'Cancelación programada' : suscripcion.estado}
                  </span>
                </div>

                <div class="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
                  <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Límites del Plan</h3>
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-gray-600">Organizaciones</span>
                      <span class="font-medium">{suscripcion.limites.maxOrganizaciones >= 999999 ? '∞' : suscripcion.limites.maxOrganizaciones}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600">Facturas/mes</span>
                      <span class="font-medium">{suscripcion.limites.maxFacturasMes >= 999999 ? '∞' : suscripcion.limites.maxFacturasMes}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600">Clientes</span>
                      <span class="font-medium">{suscripcion.limites.maxClientes >= 999999 ? '∞' : suscripcion.limites.maxClientes}</span>
                    </div>
                  </div>
                </div>

                <div class="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-5">
                  <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Funciones</h3>
                  <div class="space-y-2 text-sm">
                    <div class="flex items-center gap-2">
                      {#if suscripcion.limites.whatsapp}
                        <Check class="w-4 h-4 text-green-600" />
                      {:else}
                        <Lock class="w-4 h-4 text-gray-400" />
                      {/if}
                      <span class="{suscripcion.limites.whatsapp ? 'text-gray-700' : 'text-gray-400'}">WhatsApp</span>
                    </div>
                    <div class="flex items-center gap-2">
                      {#if suscripcion.limites.agenteIA}
                        <Check class="w-4 h-4 text-green-600" />
                      {:else}
                        <Lock class="w-4 h-4 text-gray-400" />
                      {/if}
                      <span class="{suscripcion.limites.agenteIA ? 'text-gray-700' : 'text-gray-400'}">Cobrador IA</span>
                    </div>
                    <div class="flex items-center gap-2">
                      {#if suscripcion.limites.api}
                        <Check class="w-4 h-4 text-green-600" />
                      {:else}
                        <Lock class="w-4 h-4 text-gray-400" />
                      {/if}
                      <span class="{suscripcion.limites.api ? 'text-gray-700' : 'text-gray-400'}">Acceso API</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Banner de descuento activo -->
              {#if suscripcion.descuento}
                <div class="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
                  <div class="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <Sparkles class="w-5 h-5 text-amber-700" />
                  </div>
                  <div class="flex-1">
                    <p class="font-semibold text-amber-800">
                      {suscripcion.descuento.porcentaje}% de descuento activo
                    </p>
                    <p class="text-sm text-amber-700">
                      {#if suscripcion.descuento.mesesRestantes !== null && suscripcion.descuento.mesesRestantes > 0}
                        Precio actual: <span class="font-bold">${precioConDescuento.toLocaleString('es-MX')} MXN/mes</span>
                        <span class="text-amber-600">· {suscripcion.descuento.mesesRestantes} {suscripcion.descuento.mesesRestantes === 1 ? 'mes restante' : 'meses restantes'}</span>
                      {:else}
                        {suscripcion.descuento.nombre}
                      {/if}
                    </p>
                  </div>
                  <span class="line-through text-gray-400 text-sm">${precioOriginal.toLocaleString('es-MX')}</span>
                </div>
              {/if}

              <!-- Detalles de suscripción -->
              {#if suscripcion.tieneStripe}
                <div class="border rounded-xl p-5">
                  <div class="flex items-center justify-between mb-4">
                    <h3 class="font-semibold text-gray-900">Detalles de Suscripción</h3>
                    <div class="flex items-center gap-2">
                      <button
                        on:click={abrirPortalFacturacion}
                        disabled={procesandoPortal}
                        class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                      >
                        {#if procesandoPortal}
                          <RefreshCw class="w-4 h-4 animate-spin" />
                        {:else}
                          <CreditCard class="w-4 h-4" />
                        {/if}
                        Método de pago y facturas
                      </button>
                      {#if suscripcion.estado === 'active' || suscripcion.estado === 'past_due'}
                        <button
                          on:click={abrirModalCancelar}
                          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <AlertTriangle class="w-4 h-4" />
                          Cancelar plan
                        </button>
                      {/if}
                    </div>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-{suscripcion.canceladaEn ? '3' : '2'} gap-4">
                    <div class="p-3 bg-gray-50 rounded-lg">
                      <span class="text-xs text-gray-500 uppercase tracking-wide">Inicio</span>
                      <p class="font-medium text-gray-900 mt-1">{formatearFecha(suscripcion.fechaInicio)}</p>
                    </div>
                    {#if suscripcion.canceladaEn}
                      <div class="p-3 bg-red-50 rounded-lg">
                        <span class="text-xs text-red-500 uppercase tracking-wide">Se canceló el</span>
                        <p class="font-medium text-red-700 mt-1">{formatearFecha(suscripcion.canceladaEn)}</p>
                      </div>
                    {:else}
                      <div class="p-3 bg-gray-50 rounded-lg">
                        <span class="text-xs text-gray-500 uppercase tracking-wide">Próxima renovación</span>
                        <p class="font-medium text-gray-900 mt-1">{formatearFecha(suscripcion.fechaFinPeriodo)}</p>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}

              <!-- Mensaje de estado -->
              {#if mensajePlan}
                <div class="p-3 rounded-lg {tipoMensajePlan === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}">
                  {mensajePlan}
                </div>
              {/if}

              <!-- Tarjetas de planes para upgrade -->
              <div>
                <h3 class="text-lg font-semibold text-gray-900 mb-1">
                  {suscripcion.plan === 'free' ? 'Elige un plan' : 'Cambiar de plan'}
                </h3>
                <p class="text-sm text-gray-500 mb-5">Todos los planes incluyen prueba gratuita. Cancela en cualquier momento.</p>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {#each planesInfo as plan}
                    {@const esPlanActual = suscripcion.plan === plan.id}
                    <div class="relative rounded-2xl border-2 {esPlanActual ? 'border-green-400 ring-2 ring-green-100' : plan.popular ? plan.border : 'border-gray-200'} p-6 {plan.dark && !esPlanActual ? plan.gradient + ' text-white' : 'bg-white'} transition-all hover:shadow-lg">
                      {#if plan.popular && !esPlanActual}
                        <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md">
                          Más popular
                        </div>
                      {/if}
                      {#if esPlanActual}
                        <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md">
                          Plan actual
                        </div>
                      {/if}

                      <h3 class="text-lg font-bold {plan.dark && !esPlanActual ? 'text-white' : 'text-gray-900'}">{plan.nombre}</h3>
                      <p class="text-sm {plan.dark && !esPlanActual ? 'text-gray-300' : 'text-gray-500'} mt-1">{plan.descripcion}</p>

                      <div class="mt-4 mb-5">
                        <span class="text-3xl font-black {plan.dark && !esPlanActual ? 'text-white' : 'text-gray-900'}">{plan.precio}</span>
                        <span class="{plan.dark && !esPlanActual ? 'text-gray-400' : 'text-gray-400'} text-sm"> {plan.periodo}</span>
                      </div>

                      <ul class="space-y-2.5 mb-6">
                        {#each plan.features as feat}
                          <li class="flex items-center gap-2 text-sm {plan.dark && !esPlanActual ? 'text-gray-200' : 'text-gray-600'}">
                            <div class="w-4 h-4 {plan.dark && !esPlanActual ? 'bg-green-400/20' : 'bg-green-100'} rounded flex items-center justify-center flex-shrink-0">
                              <Check class="w-3 h-3 {plan.dark && !esPlanActual ? 'text-green-400' : 'text-green-600'}" />
                            </div>
                            {feat}
                          </li>
                        {/each}
                      </ul>

                      {#if esPlanActual && suscripcion.estado !== 'canceling' && suscripcion.estado !== 'canceled'}
                        <button disabled class="w-full py-2.5 rounded-xl border-2 border-green-300 text-green-600 font-semibold text-sm cursor-default bg-green-50">
                          <Check class="w-4 h-4 inline mr-1" /> Tu plan actual
                        </button>
                      {:else if esPlanActual && (suscripcion.estado === 'canceling' || suscripcion.estado === 'canceled')}
                        <button
                          on:click={() => abrirModalCambio(plan)}
                          disabled={procesandoCambio}
                          class="w-full py-2.5 rounded-xl font-semibold text-sm transition-all border-2 border-green-400 text-green-700 hover:bg-green-50 disabled:opacity-50"
                        >
                          {procesandoCambio ? 'Procesando...' : 'Reactivar plan'}
                        </button>
                      {:else if plan.custom}
                        <button
                          on:click={() => mostrarFormularioPersonalizado = true}
                          class="w-full py-2.5 rounded-xl font-semibold text-sm transition-all border-2 {plan.btn}"
                        >
                          Solicitar presupuesto
                        </button>
                      {:else if suscripcion.tieneStripe}
                        <button
                          on:click={() => abrirModalCambio(plan)}
                          disabled={procesandoCambio}
                          class="w-full py-2.5 rounded-xl font-semibold text-sm transition-all {plan.popular ? plan.btn : 'border-2 ' + plan.btn} disabled:opacity-50"
                        >
                          {procesandoCambio ? 'Procesando...' : 'Cambiar plan'}
                        </button>
                      {:else}
                        <button
                          on:click={() => iniciarCheckout(plan.id)}
                          disabled={procesandoCheckout}
                          class="w-full py-2.5 rounded-xl font-semibold text-sm transition-all {plan.popular ? plan.btn : 'border-2 ' + plan.btn} disabled:opacity-50"
                        >
                          {#if procesandoCheckout}
                            <RefreshCw class="w-4 h-4 inline animate-spin mr-1" />
                            Procesando...
                          {:else}
                            Suscribirme
                          {/if}
                        </button>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>

              <!-- Historial de pagos -->
              {#if suscripcion.pagos && suscripcion.pagos.length > 0}
                <div class="border rounded-xl p-5">
                  <div class="flex items-center gap-2 mb-4">
                    <Receipt class="w-5 h-5 text-gray-500" />
                    <h3 class="font-semibold text-gray-900">Últimos pagos</h3>
                  </div>
                  <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="border-b text-left text-gray-500">
                          <th class="pb-2 font-medium">Fecha</th>
                          <th class="pb-2 font-medium">Monto</th>
                          <th class="pb-2 font-medium">Estado</th>
                          <th class="pb-2 font-medium">Recibo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each suscripcion.pagos as pago}
                          <tr class="border-b last:border-0">
                            <td class="py-3 text-gray-700">{formatearFecha(pago.FechaPago)}</td>
                            <td class="py-3 font-medium text-gray-900">
                              ${Number.isFinite(Number(pago.Monto)) ? Number(pago.Monto).toFixed(2) : '0.00'} {(pago.Moneda || 'MXN').toUpperCase()}
                            </td>
                            <td class="py-3">
                              <span class="px-2 py-0.5 rounded-full text-xs font-medium {pago.Estado === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                                {pago.Estado === 'paid' ? 'Pagado' : pago.Estado}
                              </span>
                            </td>
                            <td class="py-3">
                              {#if pago.UrlRecibo}
                                <a href={pago.UrlRecibo} target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                  Ver <ExternalLink class="w-3 h-3" />
                                </a>
                              {:else}
                                <span class="text-gray-400">-</span>
                              {/if}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              {/if}

              <!-- ═══ Datos de Facturación (CFDI) ═══ -->
              <div class="border rounded-xl p-5">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-2">
                    <Receipt class="w-5 h-5 text-gray-500" />
                    <h3 class="font-semibold text-gray-900">Facturación CFDI</h3>
                  </div>
                  <span class="text-xs text-gray-500">Factura oficial ante el SAT</span>
                </div>

                <p class="text-sm text-gray-600 mb-4">
                  Las facturas de Stripe son recibos de pago, no facturas fiscales válidas en México. Si necesitas un CFDI oficial para deducir tu suscripción, activa esta opción y proporciona tus datos fiscales.
                </p>

                <!-- Toggle Requiero Factura -->
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
                  <div>
                    <p class="font-medium text-gray-900">Requiero factura CFDI</p>
                    <p class="text-xs text-gray-500 mt-0.5">Se emitirá automáticamente con cada pago de suscripción</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={datosFacturacion.requiereFactura}
                    aria-label="Requiero factura fiscal"
                    on:click={() => { datosFacturacion.requiereFactura = !datosFacturacion.requiereFactura; }}
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out {datosFacturacion.requiereFactura ? 'bg-indigo-600' : 'bg-gray-200'}"
                  >
                    <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {datosFacturacion.requiereFactura ? 'translate-x-5' : 'translate-x-0'}"></span>
                  </button>
                </div>

                <!-- Formulario de datos fiscales -->
                {#if datosFacturacion.requiereFactura}
                  {#if cargandoFacturacion}
                    <div class="text-center py-4">
                      <RefreshCw class="w-5 h-5 mx-auto text-gray-400 animate-spin" />
                    </div>
                  {:else}
                    <div class="space-y-4 border-t pt-4">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- RFC -->
                        <div>
                          <label for="fact-rfc" class="block text-sm font-medium text-gray-700 mb-1">RFC</label>
                          <input
                            id="fact-rfc"
                            type="text"
                            bind:value={datosFacturacion.rfc}
                            placeholder="XAXX010101000"
                            maxlength="13"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase"
                          />
                        </div>

                        <!-- Código Postal -->
                        <div>
                          <label for="fact-cp" class="block text-sm font-medium text-gray-700 mb-1">Código Postal Fiscal</label>
                          <input
                            id="fact-cp"
                            type="text"
                            bind:value={datosFacturacion.codigoPostal}
                            placeholder="06600"
                            maxlength="5"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <!-- Razón Social -->
                      <div>
                        <label for="fact-razon" class="block text-sm font-medium text-gray-700 mb-1">Razón Social</label>
                        <input
                          id="fact-razon"
                          type="text"
                          bind:value={datosFacturacion.razonSocial}
                          placeholder="Nombre o Razón Social como aparece en tu constancia SAT"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Régimen Fiscal -->
                        <div>
                          <label for="fact-regimen" class="block text-sm font-medium text-gray-700 mb-1">Régimen Fiscal</label>
                          <select
                            id="fact-regimen"
                            bind:value={datosFacturacion.regimenFiscalId}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                          >
                            <option value={0} disabled>Seleccionar régimen</option>
                            {#each regimenesFiscales as regimen}
                              <option value={regimen.ID_Regimen}>{regimen.Codigo} - {regimen.Descripcion}</option>
                            {/each}
                          </select>
                        </div>

                        <!-- Uso CFDI -->
                        <div>
                          <label for="fact-uso" class="block text-sm font-medium text-gray-700 mb-1">Uso del CFDI</label>
                          <select
                            id="fact-uso"
                            bind:value={datosFacturacion.usoCFDI}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                          >
                            {#each usosCFDI as uso}
                              <option value={uso.codigo}>{uso.codigo} - {uso.descripcion}</option>
                            {/each}
                          </select>
                        </div>
                      </div>

                      <!-- Correo para factura -->
                      <div>
                        <label for="fact-correo" class="block text-sm font-medium text-gray-700 mb-1">Correo para recibir factura</label>
                        <input
                          id="fact-correo"
                          type="email"
                          bind:value={datosFacturacion.correo}
                          placeholder="facturacion@miempresa.com"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <!-- Mensaje -->
                      {#if mensajeFacturacion}
                        <div class="p-3 rounded-lg text-sm {tipoMensajeFacturacion === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}">
                          {mensajeFacturacion}
                        </div>
                      {/if}

                      <!-- Botón guardar -->
                      <button
                        on:click={guardarDatosFacturacion}
                        disabled={guardandoFacturacion}
                        class="w-full px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {#if guardandoFacturacion}
                          <RefreshCw class="w-4 h-4 animate-spin" />
                          Guardando...
                        {:else}
                          <Save class="w-4 h-4" />
                          Guardar datos de facturación
                        {/if}
                      </button>
                    </div>
                  {/if}
                {:else}
                  <!-- Botón guardar cuando no requiere factura (para guardar la preferencia) -->
                  {#if facturacionCargada && datosFacturacion.rfc}
                    <button
                      on:click={guardarDatosFacturacion}
                      disabled={guardandoFacturacion}
                      class="w-full px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      {#if guardandoFacturacion}
                        <RefreshCw class="w-4 h-4 animate-spin" />
                      {:else}
                        <Save class="w-4 h-4" />
                        Desactivar facturación CFDI
                      {/if}
                    </button>
                    {#if mensajeFacturacion}
                      <div class="mt-3 p-3 rounded-lg text-sm {tipoMensajeFacturacion === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}">
                        {mensajeFacturacion}
                      </div>
                    {/if}
                  {/if}
                {/if}
              </div>

            {/if}
          </div>

          <!-- ═══ MODAL: Confirmar cambio de plan ═══ -->
          {#if mostrarModalCambio && planDestino && suscripcion}
            <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" tabindex="-1" on:click|self={() => { mostrarModalCambio = false; planDestino = null; }} on:keydown={(e) => { if (e.key === 'Escape') { mostrarModalCambio = false; planDestino = null; } }}>
              <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div class="text-center mb-6">
                  <div class="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ArrowUpRight class="w-7 h-7 text-indigo-600" />
                  </div>
                  <h3 class="text-xl font-bold text-gray-900">Cambiar de plan</h3>
                  <p class="text-sm text-gray-500 mt-2">
                    ¿Deseas cambiar de <span class="font-semibold text-gray-700">{nombrePlan(suscripcion.plan)}</span> a <span class="font-semibold text-indigo-600">{planDestino.nombre}</span>?
                  </p>
                </div>

                <div class="bg-gray-50 rounded-xl p-4 mb-6 space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-600">Nuevo precio</span>
                    <span class="font-semibold text-gray-900">{planDestino.precio} {planDestino.periodo}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Prorrateo</span>
                    <span class="text-gray-700">Se ajustará automáticamente</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Efectivo</span>
                    <span class="text-gray-700">Inmediato</span>
                  </div>
                </div>

                <div class="flex gap-3">
                  <button
                    on:click={() => { mostrarModalCambio = false; planDestino = null; }}
                    class="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    on:click={confirmarCambioPlan}
                    disabled={procesandoCambio}
                    class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-700 hover:to-violet-700 transition-all disabled:opacity-50"
                  >
                    {#if procesandoCambio}
                      <RefreshCw class="w-4 h-4 inline animate-spin mr-1" />
                      Procesando...
                    {:else}
                      Confirmar cambio
                    {/if}
                  </button>
                </div>
              </div>
            </div>
          {/if}

          <!-- ═══ MODAL: Cancelar suscripción con retención ═══ -->
          {#if mostrarModalCancelar && suscripcion}
            <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" tabindex="-1" on:click|self={() => { mostrarModalCancelar = false; }} on:keydown={(e) => { if (e.key === 'Escape') { mostrarModalCancelar = false; } }}>
              <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">

                {#if pasoCancelacion === 'motivo'}
                  <!-- Paso 1: Preguntar motivo -->
                  <div class="text-center mb-6">
                    <div class="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle class="w-7 h-7 text-red-600" />
                    </div>
                    <h3 class="text-xl font-bold text-gray-900">¿Seguro que quieres cancelar?</h3>
                    <p class="text-sm text-gray-500 mt-2">Nos encantaría saber por qué para mejorar nuestro servicio.</p>
                  </div>

                  <div class="space-y-2 mb-6">
                    {#each [
                      'Es muy caro para mi presupuesto',
                      'No uso todas las funciones',
                      'Encontré otra herramienta',
                      'Problemas técnicos',
                      'Solo era temporal',
                      'Otro motivo'
                    ] as motivo}
                      <button
                        on:click={() => { motivoCancelacion = motivo; }}
                        class="w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm {motivoCancelacion === motivo ? 'border-red-400 bg-red-50 text-red-800' : 'border-gray-200 hover:border-gray-300 text-gray-700'}"
                      >
                        {motivo}
                      </button>
                    {/each}
                  </div>

                  <div class="flex gap-3">
                    <button
                      on:click={() => { mostrarModalCancelar = false; }}
                      class="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
                    >
                      Volver
                    </button>
                    <button
                      on:click={() => {
                        if (suscripcion && suscripcion.totalPagos >= 3) {
                          pasoCancelacion = 'retencion';
                        } else {
                          pasoCancelacion = 'confirmar';
                        }
                      }}
                      disabled={!motivoCancelacion}
                      class="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      Continuar
                    </button>
                  </div>

                {:else if pasoCancelacion === 'retencion'}
                  <!-- Paso 2: Oferta de retención -->
                  <div class="text-center mb-6">
                    <div class="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles class="w-7 h-7 text-amber-600" />
                    </div>
                    <h3 class="text-xl font-bold text-gray-900">¡Espera! Tenemos algo para ti</h3>
                    <p class="text-sm text-gray-500 mt-2">Antes de irte, ¿qué te parece un descuento especial?</p>
                  </div>

                  <div class="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-5 mb-6">
                    <div class="flex items-center gap-3 mb-3">
                      <div class="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center">
                        <Crown class="w-5 h-5 text-amber-700" />
                      </div>
                      <div>
                        <p class="font-bold text-gray-900">30% de descuento por 3 meses</p>
                        <p class="text-sm text-gray-600">En tu plan {nombrePlan(suscripcion.plan)}</p>
                      </div>
                    </div>

                    {#if precioOriginal > 0}
                      <div class="bg-white/70 rounded-lg p-3 mb-3">
                        <div class="flex items-center justify-between text-sm">
                          <span class="text-gray-600">Precio normal</span>
                          <span class="line-through text-gray-400">${precioOriginal.toLocaleString('es-MX')} MXN/mes</span>
                        </div>
                        <div class="flex items-center justify-between text-sm mt-1">
                          <span class="font-semibold text-amber-700">Con descuento</span>
                          <span class="font-bold text-lg text-amber-700">${precioConDescuento.toLocaleString('es-MX')} MXN/mes</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1.5">Ahorras ${ahorroMensual.toLocaleString('es-MX')} MXN/mes durante 3 meses = <span class="font-semibold">${(ahorroMensual * 3).toLocaleString('es-MX')} MXN total</span></p>
                      </div>
                    {/if}

                    <p class="text-sm text-gray-600">
                      Mantén todas las funciones de tu plan. Sin compromisos, puedes cancelar después.
                    </p>
                  </div>

                  <div class="space-y-3">
                    <button
                      on:click={aplicarCuponRetencion}
                      disabled={procesandoCancelacion}
                      class="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 shadow-lg shadow-amber-200/50"
                    >
                      {#if procesandoCancelacion}
                        <RefreshCw class="w-4 h-4 inline animate-spin mr-1" />
                        Aplicando descuento...
                      {:else}
                        ¡Sí, quiero el 30% de descuento!
                      {/if}
                    </button>
                    <button
                      on:click={() => { pasoCancelacion = 'confirmar'; }}
                      disabled={procesandoCancelacion}
                      class="w-full py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 font-medium text-sm hover:bg-gray-50 transition-colors"
                    >
                      No gracias, quiero cancelar
                    </button>
                  </div>

                {:else if pasoCancelacion === 'confirmar'}
                  <!-- Paso 3: Confirmación final -->
                  <div class="text-center mb-6">
                    <div class="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle class="w-7 h-7 text-red-600" />
                    </div>
                    <h3 class="text-xl font-bold text-gray-900">Confirmar cancelación</h3>
                    <p class="text-sm text-gray-500 mt-2">Tu suscripción se cancelará al final del periodo actual.</p>
                  </div>

                  <div class="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                    <h4 class="font-semibold text-red-800 mb-2">Perderás acceso a:</h4>
                    <ul class="space-y-1.5 text-sm text-red-700">
                      {#if suscripcion.limites.whatsapp}
                        <li class="flex items-center gap-2">
                          <Lock class="w-3.5 h-3.5" /> Cobro por WhatsApp
                        </li>
                      {/if}
                      {#if suscripcion.limites.agenteIA}
                        <li class="flex items-center gap-2">
                          <Lock class="w-3.5 h-3.5" /> Cobrador IA
                        </li>
                      {/if}
                      {#if suscripcion.limites.api}
                        <li class="flex items-center gap-2">
                          <Lock class="w-3.5 h-3.5" /> Acceso a API
                        </li>
                      {/if}
                      {#if suscripcion.limites.maxFacturasMes > 10}
                        <li class="flex items-center gap-2">
                          <Lock class="w-3.5 h-3.5" /> Facturas ilimitadas (pasarás a 10/mes)
                        </li>
                      {/if}
                      {#if suscripcion.limites.maxClientes > 10}
                        <li class="flex items-center gap-2">
                          <Lock class="w-3.5 h-3.5" /> Clientes adicionales (pasarás a 10 máx.)
                        </li>
                      {/if}
                    </ul>
                  </div>

                  {#if suscripcion.fechaFinPeriodo}
                    <p class="text-sm text-gray-600 mb-6 text-center">
                      Seguirás teniendo acceso hasta el <span class="font-semibold">{formatearFecha(suscripcion.fechaFinPeriodo)}</span>
                    </p>
                  {/if}

                  <div class="flex gap-3">
                    <button
                      on:click={() => { pasoCancelacion = 'retencion'; }}
                      class="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
                    >
                      Volver
                    </button>
                    <button
                      on:click={confirmarCancelacion}
                      disabled={procesandoCancelacion}
                      class="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {#if procesandoCancelacion}
                        <RefreshCw class="w-4 h-4 inline animate-spin mr-1" />
                        Cancelando...
                      {:else}
                        Confirmar cancelación
                      {/if}
                    </button>
                  </div>
                {/if}

              </div>
            </div>
          {/if}

      <!-- Modal Solicitud Plan Personalizado -->
      {#if mostrarFormularioPersonalizado}
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div class="p-8">
              <!-- Header -->
              <div class="mb-6">
                <h2 class="text-2xl font-bold text-gray-900 mb-2">Plan Personalizado</h2>
                <p class="text-gray-600">Cuéntanos tus necesidades y nos pondremos en contacto para crear el plan perfecto para ti</p>
              </div>

              <!-- Formulario -->
              <form on:submit|preventDefault={enviarSolicitudPersonalizado} class="space-y-5">
                <!-- Campo: Facturas -->
                <div>
                  <label for="requiereFacturas" class="block text-sm font-semibold text-gray-700 mb-2">
                    ¿Cuántas facturas necesitas por mes?
                  </label>
                  <input
                    id="requiereFacturas"
                    type="text"
                    bind:value={formPersonalizado.requiereFacturas}
                    placeholder="Ej: 1000, 5000, 10000..."
                    class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <!-- Campo: Clientes -->
                <div>
                  <label for="requiereClientes" class="block text-sm font-semibold text-gray-700 mb-2">
                    ¿Cuántos clientes tienes o esperas tener?
                  </label>
                  <input
                    id="requiereClientes"
                    type="text"
                    bind:value={formPersonalizado.requiereClientes}
                    placeholder="Ej: 50, 200, 1000..."
                    class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <!-- Campo: Integraciones -->
                <div>
                  <label for="requiereIntegraciones" class="block text-sm font-semibold text-gray-700 mb-2">
                    ¿Necesitas integraciones específicas?
                  </label>
                  <textarea
                    id="requiereIntegraciones"
                    bind:value={formPersonalizado.requiereIntegraciones}
                    placeholder="Ej: SAP, Microsoft Dynamics, Shopify, WooCommerce, etc."
                    rows="3"
                    class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  ></textarea>
                </div>

                <!-- Campo: Necesidades Especiales -->
                <div>
                  <label for="necesidadesEspeciales" class="block text-sm font-semibold text-gray-700 mb-2">
                    Necesidades especiales o comentarios adicionales
                  </label>
                  <textarea
                    id="necesidadesEspeciales"
                    bind:value={formPersonalizado.necesidesEspeciales}
                    placeholder="Cuéntanos cualquier detalle importante para tu negocio..."
                    rows="3"
                    class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  ></textarea>
                </div>

                <!-- Botones -->
                <div class="flex gap-3 mt-8">
                  <button
                    type="button"
                    on:click={() => {
                      mostrarFormularioPersonalizado = false;
                      formPersonalizado = {
                        requiereFacturas: '',
                        requiereClientes: '',
                        requiereIntegraciones: '',
                        necesidesEspeciales: ''
                      };
                    }}
                    class="flex-1 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={procesandoFormPersonalizado}
                    class="flex-1 py-2.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {#if procesandoFormPersonalizado}
                      <RefreshCw class="w-4 h-4 inline animate-spin mr-2" />
                      Enviando...
                    {:else}
                      Enviar Solicitud
                    {/if}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      {/if}

        {:else if tabActivo === 'whatsapp'}
          <!-- Configuración de WhatsApp -->
          <div class="space-y-6">
            <div class="border border-gray-200 rounded-lg p-6 bg-gradient-to-br from-green-50 to-emerald-50">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">WhatsApp Business</h3>
                  <p class="text-sm text-gray-600 mt-1">Envía facturas directamente al WhatsApp de tus clientes</p>
                </div>
                <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Smartphone class="w-6 h-6 text-green-600" />
                </div>
              </div>

              <div class="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                <div class="space-y-3">
                  <div class="flex justify-between items-center">
                    <span class="text-gray-700">Estado:</span>
                    {#if cargandoWhatsApp}
                      <span class="text-sm text-gray-500">Verificando...</span>
                    {:else if whatsappStatus === 'activo'}
                      <Badge variant="success" class="px-3 py-1">Conectado</Badge>
                    {:else if whatsappStatus === 'pendiente'}
                      <Badge variant="warning" class="px-3 py-1">Esperando escaneo</Badge>
                    {:else}
                      <Badge variant="danger" class="px-3 py-1">No conectado</Badge>
                    {/if}
                  </div>
                  {#if whatsappStatus === 'activo' && whatsappTelefono}
                    <div class="flex justify-between items-center">
                      <span class="text-gray-700">Teléfono:</span>
                      <span class="text-gray-900 font-medium">📱 {whatsappTelefono}</span>
                    </div>
                  {/if}
                </div>
              </div>

              {#if whatsappStatus === 'activo'}
                <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p class="text-sm text-green-900">
                    Tu WhatsApp está conectado y listo para enviar facturas. Puedes gestionar la conexión desde la página de configuración detallada.
                  </p>
                </div>
              {:else}
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p class="text-sm text-amber-900">
                    Tu WhatsApp no está conectado. Conecta tu teléfono para poder enviar facturas por WhatsApp.
                  </p>
                </div>
              {/if}

              <a
                href="/dashboard/configuracion/whatsapp"
                class="w-full px-4 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Smartphone class="w-4 h-4" />
                {whatsappStatus === 'activo' ? 'Administrar Conexión WhatsApp' : 'Conectar WhatsApp'}
              </a>

              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                <p class="text-xs text-gray-600 leading-relaxed mb-2">
                  <strong>¿Cómo funciona?</strong>
                </p>
                <ul class="list-disc list-inside space-y-1 text-xs text-gray-600">
                  <li>Conecta tu teléfono escaneando un código QR</li>
                  <li>Las facturas se envían automáticamente al timbrar</li>
                  <li>El cliente recibe el PDF de la factura por WhatsApp</li>
                  <li>Puedes desconectar en cualquier momento</li>
                  <li>Se recomienda usar un teléfono dedicado</li>
                </ul>
              </div>
            </div>
          </div>
        {:else if tabActivo === 'integraciones'}
          <!-- Integraciones con APIs Externas -->
          <div class="space-y-6">
            <!-- FacturaAPI Integration -->
            <div class="border border-gray-200 rounded-lg p-6 bg-gradient-to-br from-orange-50 to-amber-50">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">FacturaAPI - Facturas Electrónicas</h3>
                  <p class="text-sm text-gray-600 mt-1">Servicio para emitir facturas electrónicas válidas ante el SAT</p>
                </div>
                <div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Zap class="w-6 h-6 text-orange-600" />
                </div>
              </div>

              <div class="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                <div class="space-y-3">
                  <div class="flex justify-between items-center">
                    <span class="text-gray-700">Estado:</span>
                    <Badge variant="success" class="px-3 py-1">Conectado</Badge>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-gray-700">Tipo de clave:</span>
                    <span class="text-gray-900 font-medium">Clave de producción</span>
                  </div>
                </div>
              </div>

              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p class="text-sm text-blue-900">
                  Ocasionalmente, FacturaAPI puede requerir que generes una nueva clave de seguridad. Puedes hacerlo desde aquí de forma segura.
                </p>
              </div>

              <div class="space-y-3">
                <p class="text-sm text-gray-700">
                  Haz clic en el botón para generar una nueva clave. El proceso es automático y seguro.
                </p>
                <button
                  on:click={reiniciarApiKeyFacturaAPI}
                  disabled={reiniciandoApiKey || cargando || !organizacionSeleccionada}
                  class="w-full px-4 py-3 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <RefreshCw class="w-4 h-4 {reiniciandoApiKey ? 'animate-spin' : ''}" />
                  {reiniciandoApiKey ? 'Generando nueva clave...' : 'Generar Nueva Clave de Seguridad'}
                </button>
              </div>

              {#if mensajeApiKey}
                <div class="p-4 rounded-lg text-sm mt-4 {tipoMensajeApiKey === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}">
                  {mensajeApiKey}
                </div>
              {/if}

              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                <p class="text-xs text-gray-600 leading-relaxed mb-2">
                  <strong>¿Qué sucede cuando generas una nueva clave?</strong>
                </p>
                <ul class="list-disc list-inside space-y-1 text-xs text-gray-600">
                  <li>Se invalida la clave anterior por razones de seguridad</li>
                  <li>Se genera automáticamente una nueva clave</li>
                  <li>La nueva clave se configura en tu cuenta automáticamente</li>
                  <li>Las facturas emitidas anteriormente siguen siendo válidas</li>
                  <li>Las nuevas facturas usarán la clave actualizada</li>
                </ul>
              </div>
            </div>

            <!-- Integraciones Futuras -->
            <div class="border border-gray-200 rounded-lg p-6 opacity-50 bg-gray-50">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-lg font-semibold text-gray-600">Próximas integraciones</h3>
                  <p class="text-sm text-gray-600 mt-1">Estamos trabajando en nuevas integraciones para expandir las capacidades del sistema</p>
                </div>
              </div>
              <div class="space-y-2 text-sm text-gray-600">
                <p>🔜 Integración con bancos para automatizar pagos</p>
                <p>🔜 Sincronización con sistemas contables</p>
                <p>🔜 Webhooks para eventos de la organización</p>
              </div>
            </div>
          </div>

        {:else if tabActivo === 'cuenta'}
          <!-- Sección de Cuenta de Usuario -->
          <div class="space-y-8">
            <!-- Información Personal -->
            <div class="border border-gray-200 rounded-lg p-6">
              <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <User class="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">Información Personal</h3>
                  <p class="text-sm text-gray-500">Actualiza tu nombre y correo electrónico</p>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="cuenta-nombre" class="block text-sm font-medium text-gray-700 mb-1">Nombre <span class="text-red-500">*</span></label>
                  <input
                    id="cuenta-nombre"
                    type="text"
                    bind:value={datosCuenta.nombre}
                    maxlength="100"
                    autocomplete="given-name"
                    class="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors {erroresNombre && datosCuenta.nombre ? 'border-red-400 bg-red-50' : 'border-gray-300'}"
                    placeholder="Tu nombre"
                  />
                  {#if erroresNombre && datosCuenta.nombre}
                    <p class="text-xs text-red-500 mt-1">{erroresNombre}</p>
                  {/if}
                </div>
                <div>
                  <label for="cuenta-apellido" class="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                  <input
                    id="cuenta-apellido"
                    type="text"
                    bind:value={datosCuenta.apellido}
                    maxlength="100"
                    autocomplete="family-name"
                    class="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors {erroresApellido && datosCuenta.apellido ? 'border-red-400 bg-red-50' : 'border-gray-300'}"
                    placeholder="Tu apellido"
                  />
                  {#if erroresApellido && datosCuenta.apellido}
                    <p class="text-xs text-red-500 mt-1">{erroresApellido}</p>
                  {/if}
                </div>
                <div class="md:col-span-2">
                  <label for="cuenta-correo" class="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico <span class="text-red-500">*</span></label>
                  <input
                    id="cuenta-correo"
                    type="email"
                    bind:value={datosCuenta.correo}
                    maxlength="150"
                    autocomplete="email"
                    class="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors {erroresCorreo && datosCuenta.correo ? 'border-red-400 bg-red-50' : 'border-gray-300'}"
                    placeholder="correo@ejemplo.com"
                  />
                  {#if erroresCorreo && datosCuenta.correo}
                    <p class="text-xs text-red-500 mt-1">{erroresCorreo}</p>
                  {/if}
                </div>
              </div>

              {#if mensajeCuenta}
                <div class="mt-4 p-3 rounded-lg text-sm {tipoMensajeCuenta === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}">
                  <div class="flex items-center gap-2">
                    {#if tipoMensajeCuenta === 'success'}
                      <Check class="w-4 h-4 flex-shrink-0" />
                    {:else}
                      <AlertTriangle class="w-4 h-4 flex-shrink-0" />
                    {/if}
                    {mensajeCuenta}
                  </div>
                </div>
              {/if}

              <div class="mt-6 flex justify-end">
                <button
                  on:click={guardarDatosCuenta}
                  disabled={guardandoCuenta || !perfilValido}
                  class="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
                >
                  <Save class="w-4 h-4" />
                  {guardandoCuenta ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>

            <!-- Cambiar Contraseña -->
            <div class="border border-gray-200 rounded-lg p-6">
              <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Lock class="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">Cambiar Contraseña</h3>
                  <p class="text-sm text-gray-500">Actualiza tu contraseña de acceso</p>
                </div>
              </div>

              <div class="space-y-4 max-w-md">
                <div>
                  <label for="contrasena-actual" class="block text-sm font-medium text-gray-700 mb-1">Contraseña Actual</label>
                  <div class="relative">
                    <input
                      id="contrasena-actual"
                      type={mostrarContrasenaActual ? 'text' : 'password'}
                      bind:value={contrasenaActual}
                      maxlength="128"
                      autocomplete="current-password"
                      class="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                      placeholder="Ingresa tu contraseña actual"
                    />
                    <button
                      type="button"
                      on:click={() => mostrarContrasenaActual = !mostrarContrasenaActual}
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {#if mostrarContrasenaActual}
                        <EyeOff class="w-4 h-4" />
                      {:else}
                        <Eye class="w-4 h-4" />
                      {/if}
                    </button>
                  </div>
                </div>

                <div>
                  <label for="nueva-contrasena" class="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
                  <div class="relative">
                    <input
                      id="nueva-contrasena"
                      type={mostrarNuevaContrasena ? 'text' : 'password'}
                      bind:value={nuevaContrasena}
                      maxlength="128"
                      autocomplete="new-password"
                      class="w-full px-4 py-2.5 pr-10 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors {nuevaContrasena && !contrasenaValida ? 'border-red-400' : 'border-gray-300'}"
                      placeholder="Mínimo 10 caracteres"
                    />
                    <button
                      type="button"
                      on:click={() => mostrarNuevaContrasena = !mostrarNuevaContrasena}
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {#if mostrarNuevaContrasena}
                        <EyeOff class="w-4 h-4" />
                      {:else}
                        <Eye class="w-4 h-4" />
                      {/if}
                    </button>
                  </div>

                  <!-- Indicador de fuerza -->
                  {#if nuevaContrasena}
                    <div class="mt-2">
                      <div class="flex items-center justify-between mb-1">
                        <span class="text-xs text-gray-500">Fuerza de la contraseña</span>
                        <span class="text-xs font-medium {fuerzaContrasena <= 2 ? 'text-red-600' : fuerzaContrasena <= 4 ? 'text-yellow-600' : 'text-green-600'}">{etiquetaFuerza(fuerzaContrasena)}</span>
                      </div>
                      <div class="flex gap-1">
                        {#each Array(5) as _, i}
                          <div class="h-1.5 flex-1 rounded-full {i < fuerzaContrasena ? colorFuerza(fuerzaContrasena) : 'bg-gray-200'} transition-colors"></div>
                        {/each}
                      </div>
                      <ul class="mt-2 space-y-1">
                        <li class="text-xs flex items-center gap-1.5 {tieneMinimo ? 'text-green-600' : 'text-gray-400'}">
                          {#if tieneMinimo}<Check class="w-3 h-3" />{:else}<span class="w-3 h-3 inline-block text-center">·</span>{/if}
                          Mínimo 10 caracteres
                        </li>
                        <li class="text-xs flex items-center gap-1.5 {tieneMayuscula ? 'text-green-600' : 'text-gray-400'}">
                          {#if tieneMayuscula}<Check class="w-3 h-3" />{:else}<span class="w-3 h-3 inline-block text-center">·</span>{/if}
                          Una letra mayúscula
                        </li>
                        <li class="text-xs flex items-center gap-1.5 {tieneMinuscula ? 'text-green-600' : 'text-gray-400'}">
                          {#if tieneMinuscula}<Check class="w-3 h-3" />{:else}<span class="w-3 h-3 inline-block text-center">·</span>{/if}
                          Una letra minúscula
                        </li>
                        <li class="text-xs flex items-center gap-1.5 {tieneNumero ? 'text-green-600' : 'text-gray-400'}">
                          {#if tieneNumero}<Check class="w-3 h-3" />{:else}<span class="w-3 h-3 inline-block text-center">·</span>{/if}
                          Un número
                        </li>
                        <li class="text-xs flex items-center gap-1.5 {tieneSimbolo ? 'text-green-600' : 'text-gray-400'}">
                          {#if tieneSimbolo}<Check class="w-3 h-3" />{:else}<span class="w-3 h-3 inline-block text-center">·</span>{/if}
                          Un símbolo especial (!@#$%...)
                        </li>
                      </ul>
                    </div>
                  {/if}
                </div>

                <div>
                  <label for="confirmar-contrasena" class="block text-sm font-medium text-gray-700 mb-1">Confirmar Nueva Contraseña</label>
                  <div class="relative">
                    <input
                      id="confirmar-contrasena"
                      type={mostrarConfirmarContrasena ? 'text' : 'password'}
                      bind:value={confirmarContrasena}
                      maxlength="128"
                      autocomplete="new-password"
                      class="w-full px-4 py-2.5 pr-10 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors {confirmarContrasena && !contrasenasCoinciden ? 'border-red-400 bg-red-50' : 'border-gray-300'}"
                      placeholder="Repite la nueva contraseña"
                    />
                    <button
                      type="button"
                      on:click={() => mostrarConfirmarContrasena = !mostrarConfirmarContrasena}
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {#if mostrarConfirmarContrasena}
                        <EyeOff class="w-4 h-4" />
                      {:else}
                        <Eye class="w-4 h-4" />
                      {/if}
                    </button>
                  </div>
                  {#if confirmarContrasena && !contrasenasCoinciden}
                    <p class="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                  {:else if confirmarContrasena && contrasenasCoinciden}
                    <p class="text-xs text-green-600 mt-1 flex items-center gap-1"><Check class="w-3 h-3" /> Las contraseñas coinciden</p>
                  {/if}
                </div>
              </div>

              {#if mensajeContrasena}
                <div class="mt-4 p-3 rounded-lg text-sm {tipoMensajeContrasena === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}">
                  <div class="flex items-center gap-2">
                    {#if tipoMensajeContrasena === 'success'}
                      <Check class="w-4 h-4 flex-shrink-0" />
                    {:else}
                      <AlertTriangle class="w-4 h-4 flex-shrink-0" />
                    {/if}
                    {mensajeContrasena}
                  </div>
                </div>
              {/if}

              <div class="mt-6 flex justify-end">
                <button
                  on:click={cambiarContrasena}
                  disabled={cambiandoContrasena || !formContrasenaValido}
                  class="px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
                >
                  <Lock class="w-4 h-4" />
                  {cambiandoContrasena ? 'Cambiando...' : 'Cambiar Contraseña'}
                </button>
              </div>
            </div>

            <!-- Eliminar Cuenta -->
            <div class="border border-red-200 rounded-lg p-6 bg-red-50/30">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Trash2 class="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">Eliminar Cuenta</h3>
                  <p class="text-sm text-gray-500">Elimina permanentemente tu cuenta y todos tus datos</p>
                </div>
              </div>
              <p class="text-sm text-gray-600 mb-4">
                Esta acción es <strong>irreversible</strong>. Se eliminarán tu cuenta, organizaciones (donde seas el único miembro), facturas, clientes, pagos y suscripciones.
              </p>
              <button
                on:click={() => { mostrarModalEliminarCuenta = true; contrasenaEliminar = ''; errorEliminarCuenta = ''; }}
                class="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 font-medium"
              >
                <Trash2 class="w-4 h-4" />
                Eliminar mi cuenta
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Modal de confirmación de eliminación -->
{#if mostrarConfirmacionEliminar}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-auto">
      <div class="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
        <AlertTriangle class="w-6 h-6 text-red-600" />
      </div>
      <h3 class="text-xl font-bold text-gray-900 text-center mb-2">Eliminar Organización</h3>
      <p class="text-gray-600 text-center mb-6">
        ¿Estás seguro de que deseas eliminar la organización <strong>{datosOrganizacion.razonSocial}</strong>? Esta acción no se puede deshacer.
      </p>
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p class="text-sm text-red-800">
          <strong>Advertencia:</strong> Se eliminarán todos los datos asociados a esta organización incluyendo facturas, pagos y clientes.
        </p>
      </div>
      <div class="flex gap-3">
        <button
          on:click={() => mostrarConfirmacionEliminar = false}
          disabled={eliminando}
          class="flex-1 px-4 py-2 rounded-lg bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:opacity-50 transition-colors font-medium"
        >
          Cancelar
        </button>
        <button
          on:click={eliminarOrganizacion}
          disabled={eliminando}
          class="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
        >
          {eliminando ? 'Eliminando...' : 'Sí, Eliminar'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal de confirmación para eliminar certificados -->
{#if mostrarConfirmacionEliminarCert}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-auto">
      <div class="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mx-auto mb-4">
        <AlertTriangle class="w-6 h-6 text-orange-600" />
      </div>
      <h3 class="text-xl font-bold text-gray-900 text-center mb-2">Eliminar Certificados CSD</h3>
      <p class="text-gray-600 text-center mb-6">
        ¿Estás seguro de que deseas eliminar los certificados CSD de <strong>{datosOrganizacion.razonSocial}</strong>?
      </p>
      <div class="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
        <p class="text-sm text-orange-800">
          <strong>Advertencia:</strong> Esta acción no afecta a las facturas ya emitidas, pero no podrás emitir nuevas facturas hasta que subas nuevos certificados.
        </p>
      </div>
      <div class="flex gap-3">
        <button
          on:click={() => mostrarConfirmacionEliminarCert = false}
          disabled={eliminarCertCargando}
          class="flex-1 px-4 py-2 rounded-lg bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:opacity-50 transition-colors font-medium"
        >
          Cancelar
        </button>
        <button
          on:click={eliminarCertificados}
          disabled={eliminarCertCargando}
          class="flex-1 px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 transition-colors font-medium"
        >
          {eliminarCertCargando ? 'Eliminando...' : 'Sí, Eliminar'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal de eliminación de cuenta -->
{#if mostrarModalEliminarCuenta}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-auto">
      <div class="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
        <AlertTriangle class="w-6 h-6 text-red-600" />
      </div>
      <h3 class="text-xl font-bold text-gray-900 text-center mb-2">Eliminar Cuenta</h3>
      <p class="text-gray-600 text-center mb-4">
        Esta acción es <strong>permanente e irreversible</strong>. Se eliminarán todos tus datos, organizaciones, facturas y suscripciones.
      </p>
      <div class="mb-4">
        <label for="contrasena-eliminar" class="block text-sm font-medium text-gray-700 mb-1">Confirma tu contraseña</label>
        <input
          id="contrasena-eliminar"
          type="password"
          bind:value={contrasenaEliminar}
          autocomplete="current-password"
          class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          placeholder="Tu contraseña actual"
        />
      </div>
      {#if errorEliminarCuenta}
        <div class="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
          <div class="flex items-center gap-2">
            <AlertTriangle class="w-4 h-4 flex-shrink-0" />
            {errorEliminarCuenta}
          </div>
        </div>
      {/if}
      <div class="flex gap-3">
        <button
          on:click={() => mostrarModalEliminarCuenta = false}
          disabled={eliminandoCuenta}
          class="flex-1 px-4 py-2 rounded-lg bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:opacity-50 transition-colors font-medium"
        >
          Cancelar
        </button>
        <button
          on:click={eliminarCuenta}
          disabled={eliminandoCuenta || !contrasenaEliminar}
          class="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
        >
          {eliminandoCuenta ? 'Eliminando...' : 'Eliminar Cuenta'}
        </button>
      </div>
    </div>
  </div>
{/if}