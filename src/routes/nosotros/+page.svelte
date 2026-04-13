<script lang="ts">
  import { ArrowLeft, Building2, Target, Zap, Users, Heart } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Nosotros | CuentIA Flow</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
  <div class="max-w-3xl mx-auto px-4 py-12">
    <a href="/dashboard" class="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-8 transition-colors">
      <ArrowLeft class="w-4 h-4" />
      Volver al inicio
    </a>

    <div class="bg-white rounded-2xl shadow-sm border p-8 md:p-12">
      <div class="flex items-center gap-3 mb-8">
        <div class="p-2.5 bg-emerald-100 rounded-lg">
          <Building2 class="w-6 h-6 text-emerald-600" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900">Nosotros</h1>
      </div>

      <div class="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <p class="text-lg">CuentIA Flow es una plataforma integral diseñada para simplificar y automatizar la gestión de facturación electrónica y cobranza con inteligencia artificial para empresas de todos los tamaños en México.</p>
        </section>

        <!-- Misión -->
        <section class="bg-blue-50 rounded-xl p-6 border border-blue-100">
          <div class="flex items-center gap-3 mb-3">
            <Target class="w-5 h-5 text-blue-600" />
            <h2 class="text-xl font-semibold text-gray-900">Nuestra Misión</h2>
          </div>
          <p>Empoderar a las empresas mexicanas con herramientas tecnológicas accesibles que les permitan gestionar su facturación y cobranza de manera eficiente, reduciendo tiempos de cobro y mejorando su flujo de efectivo.</p>
        </section>

        <!-- Visión -->
        <section class="bg-purple-50 rounded-xl p-6 border border-purple-100">
          <div class="flex items-center gap-3 mb-3">
            <Zap class="w-5 h-5 text-purple-600" />
            <h2 class="text-xl font-semibold text-gray-900">Nuestra Visión</h2>
          </div>
          <p>Ser la plataforma de gestión de cobranza líder en Latinoamérica, reconocida por su innovación, facilidad de uso y el impacto positivo en la salud financiera de nuestros clientes.</p>
        </section>

        <!-- Valores -->
        <section>
          <div class="flex items-center gap-3 mb-4">
            <Heart class="w-5 h-5 text-rose-600" />
            <h2 class="text-xl font-semibold text-gray-900">Nuestros Valores</h2>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="p-4 bg-gray-50 rounded-lg border">
              <h3 class="font-semibold text-gray-900 mb-1">Transparencia</h3>
              <p class="text-sm">Operamos con honestidad y claridad en todos nuestros procesos y comunicaciones.</p>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg border">
              <h3 class="font-semibold text-gray-900 mb-1">Innovación</h3>
              <p class="text-sm">Buscamos constantemente mejorar nuestra plataforma con tecnología de vanguardia.</p>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg border">
              <h3 class="font-semibold text-gray-900 mb-1">Seguridad</h3>
              <p class="text-sm">Protegemos los datos de nuestros clientes con los más altos estándares de seguridad.</p>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg border">
              <h3 class="font-semibold text-gray-900 mb-1">Servicio al cliente</h3>
              <p class="text-sm">Nos comprometemos a brindar una atención excepcional y oportuna.</p>
            </div>
          </div>
        </section>

        <!-- Qué ofrecemos -->
        <section>
          <div class="flex items-center gap-3 mb-4">
            <Users class="w-5 h-5 text-amber-600" />
            <h2 class="text-xl font-semibold text-gray-900">¿Qué ofrecemos?</h2>
          </div>
          <ul class="space-y-3">
            <li class="flex items-start gap-3">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
              <span><strong>Facturación electrónica:</strong> Emite facturas CFDI válidas ante el SAT de forma rápida y sencilla.</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
              <span><strong>Gestión de cobranza:</strong> Controla tus cuentas por cobrar, pagos recibidos y saldos vencidos.</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
              <span><strong>Recordatorios automáticos:</strong> Envía notificaciones por correo y WhatsApp a tus clientes.</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
              <span><strong>Reportes inteligentes:</strong> Visualiza la salud financiera de tu negocio con dashboards y reportes exportables.</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
              <span><strong>Multi-organización:</strong> Gestiona múltiples empresas desde una sola cuenta.</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</div>
