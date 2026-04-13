<script lang="ts">
  import { ArrowLeft, HelpCircle, ChevronDown } from 'lucide-svelte';

  let abierto: number | null = null;

  function toggle(index: number) {
    abierto = abierto === index ? null : index;
  }

  const faqs = [
    {
      pregunta: '¿Qué es CuentIA Flow?',
      respuesta: 'CuentIA Flow es una plataforma integral de gestión de facturación electrónica (CFDI) y cobranza con inteligencia artificial. Permite emitir facturas válidas ante el SAT, controlar cuentas por cobrar, registrar pagos, enviar recordatorios automatizados a clientes y generar reportes financieros, todo potenciado por un cobrador autónomo con IA.'
    },
    {
      pregunta: '¿Cómo creo una cuenta?',
      respuesta: 'Puedes registrarte haciendo clic en "Crear cuenta" en la página de inicio. Solo necesitas proporcionar tu nombre, correo electrónico y una contraseña segura. Después de verificar tu correo electrónico, podrás configurar tu organización y comenzar a usar la plataforma.'
    },
    {
      pregunta: '¿Qué planes están disponibles?',
      respuesta: 'Ofrecemos cuatro planes: Gratuito (ideal para empezar), Básico, Profesional y Empresarial. Cada plan tiene diferentes límites de organizaciones, clientes, facturas y usuarios. Puedes ver y cambiar tu plan desde Configuración > Plan.'
    },
    {
      pregunta: '¿Las facturas son válidas ante el SAT?',
      respuesta: 'Sí. Utilizamos FacturaAPI como proveedor de facturación electrónica, que es un PAC autorizado por el SAT. Todas las facturas emitidas son CFDI 4.0 válidos. Necesitarás subir tus certificados CSD en la sección de Configuración > Certificados.'
    },
    {
      pregunta: '¿Cómo subo mis certificados CSD?',
      respuesta: 'Ve a Configuración > Certificados. Ahí podrás subir tu archivo .cer, tu archivo .key y la contraseña de tu CSD. Estos certificados son necesarios para poder emitir facturas electrónicas válidas.'
    },
    {
      pregunta: '¿Puedo gestionar varias empresas?',
      respuesta: 'Sí. CuentIA Flow es multi-organización. Puedes agregar múltiples empresas y alternar entre ellas usando el selector de organización en la barra lateral. El número de organizaciones disponibles depende de tu plan.'
    },
    {
      pregunta: '¿Cómo funcionan los recordatorios de pago?',
      respuesta: 'Puedes configurar recordatorios automáticos que se envían por correo electrónico o WhatsApp cuando una factura está próxima a vencer o ya venció. La configuración de escalonamiento permite definir cuándo se envía cada recordatorio (7, 15, 30 días, etc.).'
    },
    {
      pregunta: '¿Cómo conecto WhatsApp?',
      respuesta: 'Ve a Configuración > WhatsApp y sigue las instrucciones para conectar tu número. Se mostrará un código QR que deberás escanear con WhatsApp en tu teléfono. Una vez conectado, podrás enviar recordatorios de pago directamente por WhatsApp.'
    },
    {
      pregunta: '¿Puedo exportar mis reportes?',
      respuesta: 'Sí. En la sección de Reportes encontrarás botones de descarga CSV en cada sección (Resumen General, Aging de Cartera, Top Deudores). Los archivos se descargan con formato compatible con Excel.'
    },
    {
      pregunta: '¿Mis datos están seguros?',
      respuesta: 'Sí. Implementamos múltiples capas de seguridad: cifrado de datos, autenticación con tokens JWT en cookies httpOnly, control de acceso por roles, validación de CSRF, y auditoría de operaciones. Tus contraseñas se almacenan con hash bcrypt y nunca en texto plano.'
    },
    {
      pregunta: '¿Cómo puedo cambiar mi contraseña?',
      respuesta: 'Ve a Configuración > Cuenta > Cambiar Contraseña. Deberás ingresar tu contraseña actual y la nueva contraseña. La nueva contraseña debe tener al menos 10 caracteres, incluir mayúsculas, minúsculas, números y un símbolo especial.'
    },
    {
      pregunta: '¿Qué hago si olvido mi contraseña?',
      respuesta: 'En la pantalla de inicio de sesión, haz clic en "¿Olvidaste tu contraseña?". Ingresa tu correo electrónico y recibirás un enlace para restablecerla. El enlace tiene una vigencia limitada por seguridad.'
    }
  ];
</script>

<svelte:head>
  <title>Preguntas Frecuentes | CuentIA Flow</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
  <div class="max-w-3xl mx-auto px-4 py-12">
    <a href="/dashboard" class="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-8 transition-colors">
      <ArrowLeft class="w-4 h-4" />
      Volver al inicio
    </a>

    <div class="bg-white rounded-2xl shadow-sm border p-8 md:p-12">
      <div class="flex items-center gap-3 mb-8">
        <div class="p-2.5 bg-amber-100 rounded-lg">
          <HelpCircle class="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Preguntas Frecuentes</h1>
          <p class="text-sm text-gray-500 mt-1">Encuentra respuestas a las preguntas más comunes sobre CuentIA Flow.</p>
        </div>
      </div>

      <div class="space-y-3">
        {#each faqs as faq, i}
          <div class="border border-gray-200 rounded-lg overflow-hidden transition-colors {abierto === i ? 'border-blue-300 bg-blue-50/30' : ''}">
            <button
              on:click={() => toggle(i)}
              class="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
            >
              <span class="font-medium text-gray-900">{faq.pregunta}</span>
              <ChevronDown class="w-5 h-5 text-gray-400 flex-shrink-0 transition-transform {abierto === i ? 'rotate-180' : ''}" />
            </button>
            {#if abierto === i}
              <div class="px-5 pb-4 text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                {faq.respuesta}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
