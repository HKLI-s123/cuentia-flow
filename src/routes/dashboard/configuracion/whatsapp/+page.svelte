<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { authFetch } from '$lib/api';
	import Swal from 'sweetalert2';
	import { Smartphone, Check, AlertCircle, RefreshCw, LogOut, Shield } from 'lucide-svelte';

	let qrImage: string | null = null;
	let loading = false;
	let status: 'desconectado' | 'pendiente' | 'activo' | 'error' | 'no_encontrado' = 'desconectado';
	let telefonoConectado = '';
	let ultimaActividad = '';
	let statusError = '';

	// Polling para revisar estado
	let pollingInterval: any = null;
	let pollingCount = 0;
	const MAX_POLLING_ATTEMPTS = 90; // 90 * 2s = 3 minutos máximo de polling

	// Rate limiting para generación de QR
	let ultimoIntento = 0;
	const COOLDOWN_MS = 10000; // 10 segundos entre intentos de QR
	let cooldownRestante = 0;
	let cooldownInterval: any = null;

	// Protección contra doble-click
	let desconectando = false;

	onMount(() => {
		checkStatus();
	});

	onDestroy(() => {
		// Limpiar todos los intervalos al destruir componente
		if (pollingInterval) {
			clearInterval(pollingInterval);
			pollingInterval = null;
		}
		if (cooldownInterval) {
			clearInterval(cooldownInterval);
			cooldownInterval = null;
		}
	});

	async function checkStatus() {
		try {
			// Protección contra polling infinito
			pollingCount++;
			if (pollingCount > MAX_POLLING_ATTEMPTS) {
				if (pollingInterval) {
					clearInterval(pollingInterval);
					pollingInterval = null;
				}
				status = 'error';
				statusError = 'Tiempo de espera agotado. Intenta generar un nuevo QR.';
				qrImage = null;
				return;
			}

			const response = await authFetch('/api/whatsapp/connect-phone', {
				method: 'POST',
				body: JSON.stringify({ action: 'check-status' })
			});

			if (!response.ok) {
				console.error('Error al verificar estado');
				return;
			}

			const data = await response.json();
			const prevStatus = status;
			status = data.status || 'desconectado';
			telefonoConectado = data.telefono || '';
			ultimaActividad = data.ultimaActividad || '';
			statusError = data.error || '';

			// Si cambió a activo, limpiar QR y detener polling
			if (status === 'activo') {
				qrImage = null;
				if (pollingInterval) {
					clearInterval(pollingInterval);
					pollingInterval = null;
				}
				if (prevStatus !== 'activo') {
					Swal.fire({
						title: '¡Conectado!',
						text: `WhatsApp conectado con el número ${telefonoConectado}`,
						icon: 'success',
						confirmButtonColor: '#3b82f6'
					});
				}
			}

			// Si hay error, limpiar QR y detener polling
			if (status === 'error' || status === 'no_encontrado') {
				qrImage = null;
				if (pollingInterval) {
					clearInterval(pollingInterval);
					pollingInterval = null;
				}
			}

		} catch (error) {
			console.error('Error:', error);
		}
	}

	async function iniciarQR() {
		// Rate limit: prevenir spam de generación QR
		const ahora = Date.now();
		const tiempoDesdeUltimo = ahora - ultimoIntento;
		if (tiempoDesdeUltimo < COOLDOWN_MS) {
			const restante = Math.ceil((COOLDOWN_MS - tiempoDesdeUltimo) / 1000);
			await Swal.fire({
				title: 'Espera un momento',
				text: `Debes esperar ${restante} segundos antes de generar otro QR`,
				icon: 'info',
				confirmButtonColor: '#3b82f6'
			});
			return;
		}

		loading = true;
		qrImage = null;
		pollingCount = 0; // Resetear contador de polling
		ultimoIntento = Date.now();

		// Iniciar cooldown visual
		cooldownRestante = COOLDOWN_MS / 1000;
		if (cooldownInterval) clearInterval(cooldownInterval);
		cooldownInterval = setInterval(() => {
			cooldownRestante--;
			if (cooldownRestante <= 0) {
				clearInterval(cooldownInterval);
				cooldownInterval = null;
				cooldownRestante = 0;
			}
		}, 1000);

		try {
			const response = await authFetch('/api/whatsapp/connect-phone', {
				method: 'POST',
				body: JSON.stringify({ action: 'start-qr' })
			});

			if (!response.ok) {
				throw new Error('Error al generar QR');
			}

			const data = await response.json();

			if (data.qr) {
				qrImage = data.qr;
				status = 'pendiente';
				
				// Iniciar polling para revisar estado
				if (pollingInterval) clearInterval(pollingInterval);
				pollingInterval = setInterval(checkStatus, 2000);

				Swal.fire({
					title: 'Escanea el código QR',
					text: 'Abre WhatsApp en tu teléfono y escanea el QR con la cámara',
					icon: 'info',
					confirmButtonColor: '#3b82f6'
				});
			} else {
				Swal.fire({
					title: 'Esperando QR',
					text: 'El código QR se generará en breve. Intenta de nuevo en unos segundos.',
					icon: 'info'
				});
				setTimeout(iniciarQR, 3000);
			}

		} catch (error) {
			Swal.fire({
				title: 'Error',
				text: error instanceof Error ? error.message : 'Error desconocido',
				icon: 'error'
			});
		} finally {
			loading = false;
		}
	}

	async function desconectar() {
		if (desconectando) return; // Prevenir doble-click

		const resultado = await Swal.fire({
			title: '¿Desconectar WhatsApp?',
			text: 'Ya no podrás enviar facturas por WhatsApp hasta conectar nuevamente',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#dc2626',
			cancelButtonColor: '#6b7280',
			confirmButtonText: 'Sí, desconectar',
			cancelButtonText: 'Cancelar'
		});

		if (!resultado.isConfirmed) return;

		desconectando = true;
		try {
			const response = await authFetch('/api/whatsapp/connect-phone', {
				method: 'POST',
				body: JSON.stringify({ action: 'disconnect' })
			});

			if (!response.ok) throw new Error('Error al desconectar');

			status = 'desconectado';
			telefonoConectado = '';
			qrImage = null;
			
			if (pollingInterval) clearInterval(pollingInterval);

			await Swal.fire({
				title: '¡Desconectado!',
				text: 'Tu teléfono WhatsApp ha sido desconectado',
				icon: 'success'
			});

		} catch (error) {
			Swal.fire({
				title: 'Error',
				text: error instanceof Error ? error.message : 'Error desconocido',
				icon: 'error'
			});
		} finally {
			desconectando = false;
		}
	}

	function formatearFecha(fecha?: string): string {
		if (!fecha) return '';
		const date = new Date(fecha);
		const ahora = new Date();
		const diffMs = ahora.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);

		if (diffMins < 1) return 'Hace unos segundos';
		if (diffMins < 60) return `Hace ${diffMins}m`;
		
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `Hace ${diffHours}h`;
		
		return date.toLocaleDateString('es-MX');
	}
</script>

<div class="w-full max-w-2xl mx-auto p-6">
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
		<!-- Header -->
		<div class="flex items-center gap-3 mb-6">
			<div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
				<Smartphone class="w-6 h-6 text-green-600" />
			</div>
			<div>
				<h1 class="text-2xl font-bold text-gray-900">Configuración de WhatsApp</h1>
				<p class="text-sm text-gray-600">Conecta tu teléfono para enviar facturas por WhatsApp</p>
			</div>
		</div>

		<!-- Estado Actual -->
		<div class="bg-gray-50 rounded-lg p-4 mb-6">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-sm font-medium text-gray-700 mb-2">Estado de Conexión</h3>
					<div class="flex items-center gap-2">
						{#if status === 'activo'}
							<Check class="w-5 h-5 text-green-600" />
							<span class="text-sm font-semibold text-green-700">Conectado</span>
						{:else if status === 'pendiente'}
							<RefreshCw class="w-5 h-5 text-blue-600 animate-spin" />
							<span class="text-sm font-semibold text-blue-700">Esperando escaneo...</span>
						{:else if status === 'error'}
							<AlertCircle class="w-5 h-5 text-red-600" />
							<span class="text-sm font-semibold text-red-700">Error</span>
						{:else}
							<AlertCircle class="w-5 h-5 text-gray-600" />
							<span class="text-sm font-semibold text-gray-700">No conectado</span>
						{/if}
					</div>
				</div>

				<div class="text-right text-xs text-gray-600">
					{#if telefonoConectado}
						<p class="font-medium text-gray-900">📱 {telefonoConectado}</p>
						<p>{formatearFecha(ultimaActividad)}</p>
					{:else}
						<p class="text-gray-500">Sin conectar</p>
					{/if}
				</div>
			</div>

			{#if statusError}
				<div class="mt-3 p-2 bg-red-50 rounded border border-red-200">
					<p class="text-xs text-red-700">{statusError}</p>
				</div>
			{/if}
		</div>

		<!-- QR Display -->
		{#if qrImage}
			<div class="mb-6 flex flex-col items-center">
				<p class="text-sm text-gray-600 mb-3">Escanea este código con tu teléfono:</p>
				<div class="p-4 bg-white border-2 border-gray-300 rounded-lg">
					<img src={qrImage} alt="WhatsApp QR" class="w-64 h-64" />
				</div>
				<p class="text-xs text-gray-500 mt-3">
					Abre WhatsApp → Configuración → Vinculado → Vincular dispositivo
				</p>
			</div>
		{/if}

		<!-- Acciones -->
		<div class="flex gap-3">
			{#if status === 'activo'}
				<button
					on:click={desconectar}
					disabled={desconectando}
					class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<LogOut class="w-4 h-4" />
					{desconectando ? 'Desconectando...' : 'Desconectar'}
				</button>
			{:else}
				<button
					on:click={iniciarQR}
					disabled={loading || cooldownRestante > 0}
					class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<Smartphone class="w-4 h-4" />
					{#if loading}
						Generando QR...
					{:else if cooldownRestante > 0}
						Espera {cooldownRestante}s...
					{:else}
						Conectar Teléfono
					{/if}
				</button>
			{/if}
		</div>

		<!-- Seguridad -->
		<div class="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
			<div class="flex items-center gap-2 mb-2">
				<Shield class="w-4 h-4 text-gray-600" />
				<h4 class="text-sm font-semibold text-gray-700">Seguridad</h4>
			</div>
			<ul class="text-xs text-gray-600 space-y-1">
				<li>🔒 La sesión está cifrada de extremo a extremo</li>
				<li>🔒 Solo los administradores de la organización pueden gestionar WhatsApp</li>
				<li>🔒 Al desconectar, se eliminan todos los datos de sesión</li>
			</ul>
		</div>

		<!-- Información -->
		<div class="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
			<h4 class="text-sm font-semibold text-blue-900 mb-2">Consejos:</h4>
			<ul class="text-xs text-blue-800 space-y-1">
				<li>✓ Usa un teléfono dedicado solo a esta actividad</li>
				<li>✓ Mantén WhatsApp activo y con conexión a internet</li>
				<li>✓ No cierres sesión del navegador web de WhatsApp</li>
				<li>✓ Tu número será usado en los envíos de facturas</li>
			</ul>
		</div>
	</div>
</div>