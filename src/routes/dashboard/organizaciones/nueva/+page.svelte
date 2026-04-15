<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { Building2, Upload, X, Check, AlertCircle, ShieldAlert, CreditCard } from 'lucide-svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  // Estado del formulario
  let guardando = false;
  let error: string | null = null;
  let mensajeExito = false;
  let advertenciaCertificados: string | null = null;
  let verificandoAcceso = true;
  let tieneAcceso = false;
  let planUsuario: any = null;
  let cargandoPlan = true;

  // Datos fiscales
  let legal_name = '';
  let tax_id = '';
  let tax_system = '601'; // Régimen fiscal (por defecto: General de Ley Personas Morales)
  let email = '';
  let phone = '';
  let website = '';

  // Dirección
  let zip = '';
  let street = '';
  let exterior = '';
  let interior = '';
  let neighborhood = '';
  let city = '';
  let municipality = '';
  let state = '';
  let country = 'MEX';

  // Certificados CSD
  let archivosCSD = {
    cer: null as File | null,
    key: null as File | null,
    password: ''
  };

  // Opciones de régimen fiscal (SAT)
  const regimenesFiscales = [
    { value: '601', label: '601 - General de Ley Personas Morales' },
    { value: '603', label: '603 - Personas Morales con Fines no Lucrativos' },
    { value: '605', label: '605 - Sueldos y Salarios e Ingresos Asimilados a Salarios' },
    { value: '606', label: '606 - Arrendamiento' },
    { value: '607', label: '607 - Régimen de Enajenación o Adquisición de Bienes' },
    { value: '608', label: '608 - Demás ingresos' },
    { value: '610', label: '610 - Residentes en el Extranjero sin Establecimiento Permanente en México' },
    { value: '611', label: '611 - Ingresos por Dividendos (socios y accionistas)' },
    { value: '612', label: '612 - Personas Físicas con Actividades Empresariales y Profesionales' },
    { value: '614', label: '614 - Ingresos por intereses' },
    { value: '615', label: '615 - Régimen de los ingresos por obtención de premios' },
    { value: '616', label: '616 - Sin obligaciones fiscales' },
    { value: '620', label: '620 - Sociedades Cooperativas de Producción que optan por diferir sus ingresos' },
    { value: '621', label: '621 - Incorporación Fiscal' },
    { value: '622', label: '622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
    { value: '623', label: '623 - Opcional para Grupos de Sociedades' },
    { value: '624', label: '624 - Coordinados' },
    { value: '625', label: '625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
    { value: '626', label: '626 - Régimen Simplificado de Confianza' }
  ];

  // Manejar selección de archivos CSD
  function handleFileInput(event: Event, tipo: 'cer' | 'key') {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      archivosCSD[tipo] = input.files[0];
    }
  }

  // Remover archivo seleccionado
  function removerArchivo(tipo: 'cer' | 'key') {
    archivosCSD[tipo] = null;
  }

  // Validar formulario
  function validarFormulario(): boolean {
    if (!legal_name.trim()) {
      error = 'La razón social es requerida';
      return false;
    }

    // Validar RFC (12-13 caracteres alfanuméricos)
    if (!tax_id.trim() || !/^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(tax_id.toUpperCase())) {
      error = 'El RFC no es válido';
      return false;
    }

    if (!email.trim() || !email.includes('@')) {
      error = 'El email no es válido';
      return false;
    }

    if (!zip.trim() || !/^[0-9]{5}$/.test(zip)) {
      error = 'El código postal debe tener 5 dígitos';
      return false;
    }

    if (!street.trim() || !exterior.trim() || !neighborhood.trim() || !city.trim() || !municipality.trim() || !state.trim()) {
      error = 'Todos los campos de dirección son requeridos (excepto el interior)';
      return false;
    }

    error = null;
    return true;
  }

  // Guardar organización
  async function guardarOrganizacion() {
    if (!validarFormulario()) {
      return;
    }

    if (planUsuario && planUsuario.disponibles <= 0) {
      error = `Has alcanzado el límite de organizaciones para tu plan ${planUsuario.nombre}. Máximo: ${planUsuario.limite}`;
      return;
    }

    guardando = true;
    error = null;
    advertenciaCertificados = null;

    try {
      // 1. Crear la organización en Facturapi
      const { authFetch } = await import('$lib/api');

      const organizacionData = {
        name: legal_name.trim(),
        legal_name: legal_name.trim(),
        tax_id: tax_id.toUpperCase().trim(),
        tax_system: tax_system,
        email: email.trim(),
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        address: {
          zip: zip.trim(),
          street: street.trim(),
          exterior: exterior.trim(),
          interior: interior.trim() || undefined,
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          municipality: municipality.trim(),
          state: state.trim(),
          country: country
        }
      };

      const response = await authFetch('/api/organizaciones/crear', {
        method: 'POST',
        body: JSON.stringify(organizacionData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear la organización');
      }

      // 2. Si se proporcionaron certificados CSD, subirlos
      if (archivosCSD.cer && archivosCSD.key && archivosCSD.password) {
        const formData = new FormData();
        formData.append('cer', archivosCSD.cer);
        formData.append('key', archivosCSD.key);
        formData.append('password', archivosCSD.password);
        formData.append('organizacion_id', result.organizacionId);

        const uploadResponse = await authFetch('/api/organizaciones/subir-certificado', {
          method: 'PUT',
          body: formData
        });

        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.json();
          console.warn('Advertencia: No se pudieron subir los certificados:', uploadError);

          const mensajeBackend =
            uploadError?.details?.message ||
            uploadError?.message ||
            uploadError?.error;

          advertenciaCertificados = mensajeBackend
            ? `La organización se creó, pero los certificados CSD no se pudieron subir: ${mensajeBackend}`
            : 'La organización se creó, pero los certificados CSD no se pudieron subir. Puedes configurarlos después en configuración.';
        }
      }

      // 3. Mostrar mensaje de éxito
      mensajeExito = true;
      guardando = false;

      // 4. Redirigir al dashboard después de 2 segundos
      setTimeout(() => {
        goto('/dashboard');
      }, 2000);

    } catch (err) {
      console.error('Error al guardar organización:', err);
      error = err instanceof Error ? err.message : 'Error al guardar la organización';
      guardando = false;
    }
  }

  // Cancelar y volver
  function cancelar() {
    goto('/dashboard');
  }

  async function cargarPlan() {
    try {
      const { authFetch } = await import('$lib/api');
      const response = await authFetch('/api/usuario/plan');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          planUsuario = data.plan;
        }
      }
    } catch (err) {
      console.error('Error al cargar plan:', err);
    } finally {
      cargandoPlan = false;
    }
  }

  // Verificar acceso al montar el componente
  onMount(() => {
    if (!browser) return;

    // Verificar que el usuario esté autenticado y tenga rol de administrador
    const user = $page.data.user as any;

    if (!user) {
      // No hay usuario, redirigir al login
      goto('/');
      return;
    }

    // Verificar permisos: permitir si no tiene org aún (primera org) o si es admin (rolId 3)
    if (user.rolId && user.rolId !== 3) {
      tieneAcceso = false;
      verificandoAcceso = false;
      return;
    }

    tieneAcceso = true;
    verificandoAcceso = false;
    cargarPlan();
  });
</script>

<div class="max-w-4xl mx-auto">
  <!-- Verificando acceso -->
  {#if verificandoAcceso}
    <div class="flex items-center justify-center min-h-[400px]">
      <div class="text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4 animate-pulse">
          <Building2 class="w-8 h-8 text-blue-600" />
        </div>
        <p class="text-slate-600">Verificando permisos...</p>
      </div>
    </div>
  {:else if !tieneAcceso}
    <!-- Sin acceso -->
    <div class="flex items-center justify-center min-h-[400px]">
      <div class="text-center max-w-md">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
          <ShieldAlert class="w-8 h-8 text-red-600" />
        </div>
        <h2 class="text-2xl font-bold text-slate-900 mb-2">Acceso Restringido</h2>
        <p class="text-slate-600 mb-6">No tienes permisos para crear nuevas organizaciones. Contacta a tu administrador si necesitas acceso.</p>
        <Button variant="primary" on:click={() => goto('/dashboard')}>
          Volver al Dashboard
        </Button>
      </div>
    </div>
  {:else}
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center gap-3 mb-2">
        <div class="p-2 bg-blue-100 rounded-lg">
          <Building2 class="w-6 h-6 text-blue-600" />
        </div>
        <h1 class="text-3xl font-bold text-slate-900">Nueva Organización</h1>
      </div>
      <p class="text-slate-600">Registra una nueva organización con su información fiscal para emitir facturas</p>
    </div>

  {#if !cargandoPlan && planUsuario}
    <div class="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
      <CreditCard class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <h3 class="font-semibold text-blue-900 mb-1">Tu plan: {planUsuario.nombre}</h3>
        <p class="text-sm text-blue-700">
          Organizaciones disponibles: <strong>{planUsuario.disponibles}</strong> de <strong>{planUsuario.limite}</strong>
          ({planUsuario.creadas} creadas)
        </p>
        {#if planUsuario.disponibles === 0}
          <p class="text-sm text-red-600 mt-2 font-semibold">Has alcanzado el límite de organizaciones para tu plan</p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Mensajes -->
  {#if error}
    <div class="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
      <AlertCircle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div>
        <h3 class="font-semibold text-red-900 mb-1">Error</h3>
        <p class="text-sm text-red-700">{error}</p>
      </div>
    </div>
  {/if}

  {#if mensajeExito}
    <div class="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
      <Check class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
      <div>
        <h3 class="font-semibold text-green-900 mb-1">¡Organización creada!</h3>
        <p class="text-sm text-green-700">La organización se ha registrado correctamente. Redirigiendo al dashboard...</p>
      </div>
    </div>
  {/if}

  {#if advertenciaCertificados}
    <div class="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
      <ShieldAlert class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <h3 class="font-semibold text-amber-900 mb-1">Certificados CSD no configurados</h3>
        <p class="text-sm text-amber-700">{advertenciaCertificados}</p>
      </div>
    </div>
  {/if}

  <!-- Formulario -->
  <form on:submit|preventDefault={guardarOrganizacion} class="space-y-8">

    <!-- Información Fiscal -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 class="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
        <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <span class="text-blue-600 font-bold text-sm">1</span>
        </div>
        Información Fiscal
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Razón Social -->
        <div class="md:col-span-2">
          <Input
            id="legal_name"
            type="text"
            label="Razón Social"
            bind:value={legal_name}
            placeholder="Ej: ACME CORP S.A. DE C.V."
            required
          />
        </div>

        <!-- RFC -->
        <div>
          <Input
            id="tax_id"
            type="text"
            label="RFC"
            bind:value={tax_id}
            placeholder="Ej: ACM010101ABC"
            maxlength="13"
            class="uppercase"
            required
          />
        </div>

        <!-- Régimen Fiscal -->
        <div>
          <label for="tax_system" class="block text-sm font-medium text-slate-700 mb-2">
            Régimen Fiscal *
          </label>
          <select
            id="tax_system"
            bind:value={tax_system}
            class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            {#each regimenesFiscales as regimen}
              <option value={regimen.value}>{regimen.label}</option>
            {/each}
          </select>
        </div>

        <!-- Email -->
        <div>
          <Input
            id="email"
            type="email"
            label="Email"
            bind:value={email}
            placeholder="contacto@acme.com"
            required
          />
        </div>

        <!-- Teléfono -->
        <div>
          <Input
            id="phone"
            type="tel"
            label="Teléfono"
            bind:value={phone}
            placeholder="5512345678"
          />
        </div>

        <!-- Sitio Web -->
        <div class="md:col-span-2">
          <Input
            id="website"
            type="url"
            label="Sitio Web"
            bind:value={website}
            placeholder="https://www.acme.com"
          />
        </div>
      </div>
    </div>

    <!-- Dirección Fiscal -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 class="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
        <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <span class="text-blue-600 font-bold text-sm">2</span>
        </div>
        Dirección Fiscal
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Código Postal -->
        <div>
          <Input
            id="zip"
            type="text"
            label="Código Postal"
            bind:value={zip}
            placeholder="01234"
            maxlength="5"
            required
          />
        </div>

        <!-- Calle -->
        <div>
          <Input
            id="street"
            type="text"
            label="Calle"
            bind:value={street}
            placeholder="Av. Insurgentes"
            required
          />
        </div>

        <!-- Número Exterior -->
        <div>
          <Input
            id="exterior"
            type="text"
            label="No. Exterior"
            bind:value={exterior}
            placeholder="123"
            required
          />
        </div>

        <!-- Número Interior -->
        <div>
          <Input
            id="interior"
            type="text"
            label="No. Interior"
            bind:value={interior}
            placeholder="Depto 4B"
          />
        </div>

        <!-- Colonia -->
        <div>
          <Input
            id="neighborhood"
            type="text"
            label="Colonia"
            bind:value={neighborhood}
            placeholder="Roma Norte"
            required
          />
        </div>

        <!-- Ciudad -->
        <div>
          <Input
            id="city"
            type="text"
            label="Ciudad"
            bind:value={city}
            placeholder="Ciudad de México"
            required
          />
        </div>

        <!-- Municipio/Alcaldía -->
        <div>
          <Input
            id="municipality"
            type="text"
            label="Municipio/Alcaldía"
            bind:value={municipality}
            placeholder="Cuauhtémoc"
            required
          />
        </div>

        <!-- Estado -->
        <div>
          <Input
            id="state"
            type="text"
            label="Estado"
            bind:value={state}
            placeholder="Ciudad de México"
            required
          />
        </div>
      </div>
    </div>

    <!-- Certificados CSD (Opcional) -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 class="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
        <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <span class="text-blue-600 font-bold text-sm">3</span>
        </div>
        Certificados CSD (Opcional)
      </h2>
      <p class="text-sm text-slate-600 mb-4">Puedes agregar los certificados ahora o hacerlo más tarde desde la configuración</p>
      <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p class="text-sm text-amber-800">
          Nota: Los sellos digitales (CSD) son diferentes a la FIEL. Los CSD se usan para facturar y se solicitan directamente ante el SAT.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Archivo .cer -->
        <div>
          <span class="block text-sm font-medium text-slate-700 mb-2">
            Certificado (.cer)
          </span>
          {#if archivosCSD.cer}
            <div class="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Check class="w-4 h-4 text-green-600 flex-shrink-0" />
              <span class="text-sm text-green-700 flex-1 truncate">{archivosCSD.cer.name}</span>
              <button
                type="button"
                on:click={() => removerArchivo('cer')}
                class="p-1 hover:bg-green-100 rounded transition-colors"
              >
                <X class="w-4 h-4 text-green-600" />
              </button>
            </div>
          {:else}
            <label for="file-cer" class="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
              <Upload class="w-5 h-5 text-slate-400" />
              <span class="text-sm text-slate-600">Seleccionar archivo .cer</span>
              <input
                id="file-cer"
                type="file"
                accept=".cer"
                on:change={(e) => handleFileInput(e, 'cer')}
                class="hidden"
              />
            </label>
          {/if}
        </div>

        <!-- Archivo .key -->
        <div>
          <span class="block text-sm font-medium text-slate-700 mb-2">
            Llave Privada (.key)
          </span>
          {#if archivosCSD.key}
            <div class="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Check class="w-4 h-4 text-green-600 flex-shrink-0" />
              <span class="text-sm text-green-700 flex-1 truncate">{archivosCSD.key.name}</span>
              <button
                type="button"
                on:click={() => removerArchivo('key')}
                class="p-1 hover:bg-green-100 rounded transition-colors"
              >
                <X class="w-4 h-4 text-green-600" />
              </button>
            </div>
          {:else}
            <label for="file-key" class="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
              <Upload class="w-5 h-5 text-slate-400" />
              <span class="text-sm text-slate-600">Seleccionar archivo .key</span>
              <input
                id="file-key"
                type="file"
                accept=".key"
                on:change={(e) => handleFileInput(e, 'key')}
                class="hidden"
              />
            </label>
          {/if}
        </div>

        <!-- Contraseña de la llave privada -->
        <div class="md:col-span-2">
          <Input
            id="csd_password"
            type="password"
            label="Contraseña de la Llave Privada"
            bind:value={archivosCSD.password}
            placeholder="Contraseña del certificado CSD"
            disabled={!archivosCSD.cer || !archivosCSD.key}
          />
        </div>
      </div>
    </div>

    <!-- Botones de acción -->
    <div class="flex gap-4 justify-end">
      <Button
        type="button"
        variant="secondary"
        size="lg"
        on:click={cancelar}
        disabled={guardando}
      >
        Cancelar
      </Button>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={guardando}
        loading={guardando}
      >
        {#if !guardando}
          <Check class="w-5 h-5" />
          Crear Organización
        {/if}
      </Button>
    </div>
  </form>
  {/if}
</div>
