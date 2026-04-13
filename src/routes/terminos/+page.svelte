<script lang="ts">
  import { ArrowLeft, FileText } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Términos y Condiciones | CuentIA Flow</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
  <div class="max-w-3xl mx-auto px-4 py-12">
    <a href="/dashboard" class="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-8 transition-colors">
      <ArrowLeft class="w-4 h-4" />
      Volver al inicio
    </a>

    <div class="bg-white rounded-2xl shadow-sm border p-8 md:p-12">
      <div class="flex items-center gap-3 mb-8">
        <div class="p-2.5 bg-purple-100 rounded-lg">
          <FileText class="w-6 h-6 text-purple-600" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900">Términos y Condiciones</h1>
      </div>

      <p class="text-sm text-gray-400 mb-8">Última actualización: 1 de enero de 2026</p>

      <div class="prose prose-slate max-w-none space-y-6 text-gray-700 leading-relaxed">
        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">1. Aceptación de los términos</h2>
          <p>Al registrarse y utilizar CuentIA Flow, usted acepta los presentes Términos y Condiciones en su totalidad. Si no está de acuerdo con alguno de estos términos, le solicitamos abstenerse de utilizar la plataforma.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">2. Descripción del servicio</h2>
          <p>CuentIA Flow es una plataforma de gestión de facturación electrónica y cobranza que permite a las organizaciones:</p>
          <ul class="list-disc pl-6 space-y-1 mt-2">
            <li>Emitir facturas electrónicas válidas ante el SAT</li>
            <li>Gestionar cuentas por cobrar y pagos</li>
            <li>Enviar recordatorios de pago automatizados</li>
            <li>Generar reportes financieros y de cobranza</li>
            <li>Administrar clientes y organizaciones</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">3. Registro y cuenta de usuario</h2>
          <p>Para utilizar la plataforma, debe crear una cuenta proporcionando información veraz y actualizada. Usted es responsable de mantener la confidencialidad de sus credenciales de acceso y de todas las actividades realizadas bajo su cuenta.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">4. Uso aceptable</h2>
          <p>El usuario se compromete a:</p>
          <ul class="list-disc pl-6 space-y-1 mt-2">
            <li>Utilizar la plataforma únicamente para fines lícitos</li>
            <li>No intentar acceder a cuentas o datos de otros usuarios</li>
            <li>No realizar actividades que puedan dañar, sobrecargar o deteriorar el servicio</li>
            <li>Proporcionar información fiscal veraz y actualizada</li>
            <li>Cumplir con la legislación fiscal mexicana aplicable</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">5. Planes y facturación</h2>
          <p>La plataforma ofrece diferentes planes de servicio (Gratuito, Básico, Profesional y Empresarial). Cada plan tiene límites específicos en cuanto al número de organizaciones, clientes, facturas y usuarios permitidos. El cambio de plan puede realizarse en cualquier momento desde la sección de Configuración.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">6. Propiedad intelectual</h2>
          <p>Todos los derechos de propiedad intelectual de la plataforma, incluyendo el software, diseño, logotipos y contenido, son propiedad exclusiva de CuentIA Flow by Aurenix. Los datos ingresados por el usuario son propiedad del mismo.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">7. Limitación de responsabilidad</h2>
          <p>La plataforma se proporciona "tal cual" y "según disponibilidad". No garantizamos que el servicio sea ininterrumpido o libre de errores. No seremos responsables por daños indirectos, incidentales o consecuentes derivados del uso o imposibilidad de uso del servicio.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">8. Cancelación y terminación</h2>
          <p>El usuario puede cancelar su cuenta en cualquier momento. Nos reservamos el derecho de suspender o cancelar cuentas que violen estos términos. En caso de cancelación, los datos del usuario serán eliminados conforme a nuestra política de retención de datos.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">9. Modificaciones</h2>
          <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán notificados a través de la plataforma y entrarán en vigor al momento de su publicación.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-3">10. Legislación aplicable</h2>
          <p>Los presentes términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia será resuelta ante los tribunales competentes.</p>
        </section>
      </div>
    </div>
  </div>
</div>
