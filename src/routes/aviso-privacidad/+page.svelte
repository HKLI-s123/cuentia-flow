<script lang="ts">
  import { ArrowLeft, Shield } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Aviso de Privacidad | CuentIA Flow</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
  <div class="max-w-3xl mx-auto px-4 py-12">
    <a href="/dashboard" class="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-8 transition-colors">
      <ArrowLeft class="w-4 h-4" />
      Volver al inicio
    </a>

    <div class="bg-white rounded-2xl shadow-sm border p-8 md:p-12">
      <div class="flex items-center gap-3 mb-8">
        <div class="p-2.5 bg-blue-100 rounded-lg">
          <Shield class="w-6 h-6 text-blue-600" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900">Aviso de Privacidad</h1>
      </div>

      <p class="text-sm text-gray-400 mb-8">Última actualización: 1 de enero de 2026</p>

      <div class="prose prose-slate max-w-none space-y-6 text-gray-700 leading-relaxed">
        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">1. Responsable del tratamiento</h2>
          <p>CuentIA Flow (en adelante "la Plataforma") es responsable del tratamiento de los datos personales que recabe de sus usuarios, de conformidad con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y demás normatividad aplicable.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">2. Datos personales que recabamos</h2>
          <p>Para la prestación de nuestros servicios recabamos los siguientes datos personales:</p>
          <ul class="list-disc pl-6 space-y-1 mt-2">
            <li>Nombre completo y apellidos</li>
            <li>Correo electrónico</li>
            <li>Teléfono de contacto</li>
            <li>Datos fiscales (RFC, razón social, régimen fiscal, domicilio fiscal)</li>
            <li>Información de facturación y cobranza</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">3. Finalidad del tratamiento</h2>
          <p>Los datos personales que recabamos se utilizan para las siguientes finalidades:</p>
          <ul class="list-disc pl-6 space-y-1 mt-2">
            <li>Crear y administrar su cuenta de usuario</li>
            <li>Gestionar la facturación electrónica y procesos de cobranza</li>
            <li>Enviar notificaciones y recordatorios de pago</li>
            <li>Generar reportes financieros y de gestión</li>
            <li>Brindar soporte técnico y atención al cliente</li>
            <li>Mejorar la experiencia de uso de la plataforma</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">4. Protección de datos</h2>
          <p>Implementamos medidas de seguridad administrativas, técnicas y físicas para proteger sus datos personales contra daño, pérdida, alteración, destrucción o el uso, acceso o tratamiento no autorizado. Entre ellas:</p>
          <ul class="list-disc pl-6 space-y-1 mt-2">
            <li>Cifrado de datos en tránsito y en reposo</li>
            <li>Autenticación segura con tokens JWT y cookies httpOnly</li>
            <li>Control de acceso basado en roles</li>
            <li>Auditoría de accesos y operaciones</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">5. Transferencia de datos</h2>
          <p>No compartimos sus datos personales con terceros, salvo cuando sea necesario para la prestación del servicio (por ejemplo, proveedores de facturación electrónica como FacturaAPI) o cuando sea requerido por autoridades competentes.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">6. Derechos ARCO</h2>
          <p>Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos personales. Para ejercer estos derechos, puede comunicarse a través de la sección de Configuración de su cuenta o enviando un correo a nuestro equipo de soporte.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">7. Uso de cookies</h2>
          <p>Utilizamos cookies estrictamente necesarias para el funcionamiento de la plataforma, incluyendo tokens de autenticación y preferencias de sesión. No utilizamos cookies de seguimiento o publicidad de terceros.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">8. Cambios al aviso de privacidad</h2>
          <p>Nos reservamos el derecho de modificar el presente aviso de privacidad. Cualquier cambio será notificado a través de la plataforma.</p>
        </section>
      </div>
    </div>
  </div>
</div>
