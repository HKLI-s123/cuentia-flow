<script lang="ts">
  import { onMount } from 'svelte';
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
    Palette
  } from 'lucide-svelte';
  import { Button, Input, Badge } from '$lib/components/ui';

  // Estado de la configuración
  let organizacionActual: any = {};
  let configuracionCobranza: any = {};
  let configuracionEmail: any = {};
  let cargando = true;
  let guardando = false;
  let mensaje = '';
  let tipoMensaje = '';

  // Estado de tabs
  let tabActivo = 'organizacion';

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
    }
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
    await cargarConfiguracion();
  });

  async function cargarConfiguracion() {
    cargando = true;
    try {
      // Cargar datos de la organización actual
      const userData = sessionStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
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

  function mostrarMensaje(texto: string, tipo: 'success' | 'error') {
    mensaje = texto;
    tipoMensaje = tipo;
    setTimeout(() => {
      mensaje = '';
      tipoMensaje = '';
    }, 5000);
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
          <!-- <button
            on:click={() => tabActivo = 'cobranza'}
            class="py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors {tabActivo === 'cobranza' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          >
            <Zap class="w-4 h-4 inline mr-2" />
            Cobranza
          </button>
          <button
            on:click={() => tabActivo = 'plantillas'}
            class="py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors {tabActivo === 'plantillas' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          >
            <FileText class="w-4 h-4 inline mr-2" />
            Plantillas
          </button> -->
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
                <Input
                  id="rfc"
                  type="text"
                  bind:value={datosOrganizacion.rfc}
                  label="RFC"
                  placeholder="ABC123456789"
                  required
                />
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

            <!-- Botón Guardar -->
            <div class="border-t pt-6 flex justify-end">
              <Button
                variant="primary"
                size="lg"
                on:click={guardarConfiguracion}
                disabled={guardando || cargando}
                loading={guardando}
              >
                <Save class="w-5 h-5 mr-2" />
                {guardando ? '' : 'Guardar Cambios'}
              </Button>
            </div>
          </div>

        {:else if tabActivo === 'cobranza'}
          <!-- Configuración de Cobranza -->
          <div class="space-y-6">
            <div class="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
              <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Zap class="w-5 h-5 mr-2 text-purple-600" />
                Configuración Automática
              </h2>
              <div class="space-y-4">
                <div class="flex items-center">
                  <input
                    id="envio-automatico"
                    type="checkbox"
                    bind:checked={configCobranza.envioAutomaticoRecordatorios}
                    class="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label for="envio-automatico" class="ml-3 text-sm text-gray-700">
                    Activar envío automático de recordatorios
                  </label>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label for="dias-gracia" class="block text-sm font-medium text-gray-700 mb-2">Días de Gracia</label>
                    <input
                      id="dias-gracia"
                      type="number"
                      bind:value={configCobranza.diasGracia}
                      min="0"
                      max="30"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <p class="text-xs text-gray-500 mt-1">Días después del vencimiento antes del primer recordatorio</p>
                  </div>
                  <div>
                    <label for="recordatorio-previo" class="block text-sm font-medium text-gray-700 mb-2">Recordatorio Previo</label>
                    <input
                      id="recordatorio-previo"
                      type="number"
                      bind:value={configCobranza.diasRecordatorioPrevio}
                      min="1"
                      max="15"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <p class="text-xs text-gray-500 mt-1">Días antes del vencimiento para enviar recordatorio</p>
                  </div>
                  <div>
                    <div class="block text-sm font-medium text-gray-700 mb-2">Hora de Envío</div>
                    <div class="flex space-x-2">
                      <div class="flex-1">
                        <label for="hora-inicio" class="sr-only">Hora de inicio</label>
                        <input
                          id="hora-inicio"
                          type="time"
                          bind:value={configCobranza.horariosEnvio.horaInicio}
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      <span class="self-center text-gray-500">a</span>
                      <div class="flex-1">
                        <label for="hora-fin" class="sr-only">Hora de fin</label>
                        <input
                          id="hora-fin"
                          type="time"
                          bind:value={configCobranza.horariosEnvio.horaFin}
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Escalamiento de Cobranza -->
            <div>
              <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Bell class="w-5 h-5 mr-2 text-orange-600" />
                Escalamiento de Cobranza
              </h2>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <label for="primer-recordatorio" class="text-yellow-800 font-medium mb-2 block">1er Recordatorio</label>
                  <input
                    id="primer-recordatorio"
                    type="number"
                    bind:value={configCobranza.escalonamiento.primer_recordatorio}
                    min="1"
                    class="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                  <p class="text-xs text-yellow-700 mt-1">Días después del vencimiento</p>
                </div>
                <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <label for="segundo-recordatorio" class="text-orange-800 font-medium mb-2 block">2do Recordatorio</label>
                  <input
                    id="segundo-recordatorio"
                    type="number"
                    bind:value={configCobranza.escalonamiento.segundo_recordatorio}
                    min="1"
                    class="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <p class="text-xs text-orange-700 mt-1">Días después del vencimiento</p>
                </div>
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                  <label for="gestion-telefonica" class="text-red-800 font-medium mb-2 block">Gestión Telefónica</label>
                  <input
                    id="gestion-telefonica"
                    type="number"
                    bind:value={configCobranza.escalonamiento.gestion_telefonica}
                    min="1"
                    class="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <p class="text-xs text-red-700 mt-1">Días después del vencimiento</p>
                </div>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <label for="proceso-legal" class="text-gray-800 font-medium mb-2 block">Proceso Legal</label>
                  <input
                    id="proceso-legal"
                    type="number"
                    bind:value={configCobranza.escalonamiento.proceso_legal}
                    min="1"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  />
                  <p class="text-xs text-gray-700 mt-1">Días después del vencimiento</p>
                </div>
              </div>
            </div>

            <!-- Días de la semana activos -->
            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Días Activos para Envío</h3>
              <div class="flex flex-wrap gap-2">
                {#each ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as dia, index}
                  <label for="dia-{index}" class="flex items-center">
                    <input
                      id="dia-{index}"
                      type="checkbox"
                      bind:group={configCobranza.horariosEnvio.diasSemana}
                      value={dia}
                      class="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span class="ml-2 text-sm text-gray-700 capitalize">{dia}</span>
                  </label>
                {/each}
              </div>
            </div>
          </div>


        {:else if tabActivo === 'plantillas'}
          <!-- Plantillas de Email -->
          <div class="space-y-6">
            <div>
              <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText class="w-5 h-5 mr-2 text-green-600" />
                Plantillas de Email
              </h2>

              <!-- Recordatorio de Pago -->
              <div class="border border-gray-200 rounded-lg p-6 mb-6">
                <h3 class="text-md font-semibold text-gray-900 mb-4 flex items-center">
                  <Bell class="w-4 h-4 mr-2 text-yellow-600" />
                  Recordatorio de Pago
                </h3>
                <div class="grid grid-cols-1 gap-4">
                  <div>
                    <label for="asunto-recordatorio" class="block text-sm font-medium text-gray-700 mb-2">Asunto</label>
                    <input
                      id="asunto-recordatorio"
                      type="text"
                      bind:value={configEmail.plantillas.recordatorio_pago.asunto}
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label for="cuerpo-recordatorio" class="block text-sm font-medium text-gray-700 mb-2">Cuerpo del Email</label>
                    <textarea
                      id="cuerpo-recordatorio"
                      bind:value={configEmail.plantillas.recordatorio_pago.cuerpo}
                      rows="8"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Contenido del email..."
                    ></textarea>
                    <div class="mt-2 text-xs text-gray-500">
                      Variables disponibles: {'{nombre_cliente}'}, {'{numero_factura}'}, {'{monto_total}'}, {'{fecha_vencimiento}'}, {'{dias_vencido}'}, {'{nombre_empresa}'}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Segunda Notificación -->
              <div class="border border-gray-200 rounded-lg p-6">
                <h3 class="text-md font-semibold text-gray-900 mb-4 flex items-center">
                  <Bell class="w-4 h-4 mr-2 text-red-600" />
                  Segunda Notificación
                </h3>
                <div class="grid grid-cols-1 gap-4">
                  <div>
                    <label for="asunto-segunda" class="block text-sm font-medium text-gray-700 mb-2">Asunto</label>
                    <input
                      id="asunto-segunda"
                      type="text"
                      bind:value={configEmail.plantillas.segunda_notificacion.asunto}
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label for="cuerpo-segunda" class="block text-sm font-medium text-gray-700 mb-2">Cuerpo del Email</label>
                    <textarea
                      id="cuerpo-segunda"
                      bind:value={configEmail.plantillas.segunda_notificacion.cuerpo}
                      rows="8"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Contenido del email..."
                    ></textarea>
                    <div class="mt-2 text-xs text-gray-500">
                      Variables disponibles: {'{nombre_cliente}'}, {'{numero_factura}'}, {'{monto_pendiente}'}, {'{dias_vencido}'}, {'{nombre_empresa}'}, {'{telefono_empresa}'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>