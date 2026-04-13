<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Upload, CheckCircle, AlertCircle, Loader, FileText, X, Image } from 'lucide-svelte';

	let token = '';
	let estado: 'cargando' | 'listo' | 'subiendo' | 'exito' | 'error' | 'usado' = 'cargando';
	let mensajeError = '';
	let infoPago: any = null;

	// Archivo
	let archivoSeleccionado: File | null = null;
	let previewImagen: string | null = null;
	let archivoError: string | null = null;

	const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
	const MAX_FILE_SIZE = 5 * 1024 * 1024;

	onMount(async () => {
		token = $page.params.token ?? '';
		await verificarToken();
	});

	async function verificarToken() {
		try {
			const res = await fetch(`/api/comprobante-publico/${token}`);
			const data = await res.json();

			if (res.ok && data.success) {
				infoPago = data.pago;
				estado = 'listo';
			} else if (res.status === 409) {
				estado = 'usado';
				mensajeError = data.error || 'Ya se subió un comprobante para este pago.';
			} else {
				estado = 'error';
				mensajeError = data.error || 'Link inválido o expirado.';
			}
		} catch {
			estado = 'error';
			mensajeError = 'Error de conexión. Intenta de nuevo.';
		}
	}

	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		archivoError = null;

		if (!file) {
			archivoSeleccionado = null;
			previewImagen = null;
			return;
		}

		if (!ALLOWED_TYPES.includes(file.type)) {
			archivoError = 'Formato no permitido. Usa JPEG, PNG, WebP o GIF.';
			input.value = '';
			return;
		}

		if (file.size > MAX_FILE_SIZE) {
			archivoError = 'La imagen excede el tamaño máximo de 5 MB.';
			input.value = '';
			return;
		}

		archivoSeleccionado = file;
		const reader = new FileReader();
		reader.onload = () => {
			previewImagen = reader.result as string;
		};
		reader.readAsDataURL(file);
	}

	function removerArchivo() {
		archivoSeleccionado = null;
		previewImagen = null;
		archivoError = null;
	}

	async function subirComprobante() {
		if (!previewImagen || !archivoSeleccionado) return;

		estado = 'subiendo';
		try {
			const res = await fetch(`/api/comprobante-publico/${token}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					imagenBase64: previewImagen,
					mimetype: archivoSeleccionado.type
				})
			});

			const data = await res.json();

			if (res.ok && data.success) {
				estado = 'exito';
			} else {
				estado = 'listo';
				mensajeError = data.error || 'Error al subir el comprobante.';
			}
		} catch {
			estado = 'listo';
			mensajeError = 'Error de conexión. Intenta de nuevo.';
		}
	}

	function formatearMoneda(monto: number): string {
		return new Intl.NumberFormat('es-MX', {
			style: 'currency',
			currency: 'MXN'
		}).format(monto || 0);
	}

	function formatearFecha(fecha: string): string {
		if (!fecha) return '';
		const d = new Date(fecha);
		return new Intl.DateTimeFormat('es-MX', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		}).format(d);
	}
</script>

<svelte:head>
	<title>Subir Comprobante de Pago</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<!-- Logo / Header -->
		<div class="text-center mb-6">
			<div class="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-3">
				<FileText class="w-7 h-7 text-white" />
			</div>
			<h1 class="text-xl font-bold text-gray-900">Comprobante de Pago</h1>
			{#if infoPago?.organizacion}
				<p class="text-sm text-gray-500 mt-1">{infoPago.organizacion}</p>
			{/if}
		</div>

		<div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
			<!-- Estado: Cargando -->
			{#if estado === 'cargando'}
				<div class="flex flex-col items-center justify-center py-16 px-6">
					<Loader class="w-10 h-10 animate-spin text-blue-600 mb-4" />
					<p class="text-gray-500">Verificando link...</p>
				</div>

			<!-- Estado: Error / Expirado / Usado -->
			{:else if estado === 'error' || estado === 'usado'}
				<div class="flex flex-col items-center justify-center py-16 px-6">
					<div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
						<AlertCircle class="w-8 h-8 text-red-500" />
					</div>
					<h2 class="text-lg font-semibold text-gray-900 mb-2">
						{#if estado === 'usado'}
							Comprobante ya enviado
						{:else}
							Link inválido
						{/if}
					</h2>
					<p class="text-sm text-gray-500 text-center">{mensajeError}</p>
				</div>

			<!-- Estado: Éxito -->
			{:else if estado === 'exito'}
				<div class="flex flex-col items-center justify-center py-16 px-6">
					<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
						<CheckCircle class="w-8 h-8 text-green-500" />
					</div>
					<h2 class="text-lg font-semibold text-gray-900 mb-2">¡Comprobante enviado!</h2>
					<p class="text-sm text-gray-500 text-center">
						Tu comprobante de pago ha sido recibido correctamente. Puedes cerrar esta página.
					</p>
				</div>

			<!-- Estado: Listo para subir -->
			{:else if estado === 'listo' || estado === 'subiendo'}
				<div class="p-6 space-y-5">
					<!-- Info del pago -->
					{#if infoPago}
						<div class="bg-blue-50 rounded-xl p-4">
							<p class="text-xs text-blue-600 font-medium uppercase tracking-wider mb-2">Información del pago</p>
							<div class="grid grid-cols-2 gap-3">
								{#if infoPago.numeroFactura}
									<div>
										<p class="text-xs text-gray-500">Factura</p>
										<p class="text-sm font-semibold text-gray-900">#{infoPago.numeroFactura}</p>
									</div>
								{/if}
								{#if infoPago.monto}
									<div>
										<p class="text-xs text-gray-500">Monto</p>
										<p class="text-sm font-semibold text-blue-700">{formatearMoneda(infoPago.monto)}</p>
									</div>
								{/if}
								{#if infoPago.fechaPago}
									<div class="col-span-2">
										<p class="text-xs text-gray-500">Fecha de pago</p>
										<p class="text-sm font-medium text-gray-900">{formatearFecha(infoPago.fechaPago)}</p>
									</div>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Error inline -->
					{#if mensajeError}
						<div class="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
							<AlertCircle class="w-4 h-4 text-red-500 flex-shrink-0" />
							<p class="text-sm text-red-700">{mensajeError}</p>
						</div>
					{/if}

					{#if archivoError}
						<div class="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
							<AlertCircle class="w-4 h-4 text-red-500 flex-shrink-0" />
							<p class="text-sm text-red-700">{archivoError}</p>
						</div>
					{/if}

					<!-- Upload area -->
					{#if previewImagen}
						<div class="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
							<img
								src={previewImagen}
								alt="Vista previa del comprobante"
								class="max-h-56 mx-auto object-contain p-2"
							/>
							<button
								on:click={removerArchivo}
								disabled={estado === 'subiendo'}
								class="absolute top-2 right-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-1.5 transition-colors disabled:opacity-50"
								title="Remover"
							>
								<X class="w-4 h-4" />
							</button>
							<div class="bg-gray-100 px-3 py-2 text-xs text-gray-600 flex items-center gap-2">
								<Image class="w-3.5 h-3.5" />
								{archivoSeleccionado?.name}
								({(archivoSeleccionado?.size ? archivoSeleccionado.size / 1024 : 0).toFixed(0)} KB)
							</div>
						</div>
					{:else}
						<label
							class="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 hover:border-blue-400 transition-all"
						>
							<div class="flex flex-col items-center justify-center pt-3 pb-4">
								<Upload class="w-8 h-8 text-gray-400 mb-2" />
								<p class="text-sm font-medium text-gray-600">Selecciona tu comprobante</p>
								<p class="text-xs text-gray-400 mt-1">JPEG, PNG, WebP o GIF (máx. 5 MB)</p>
							</div>
							<input
								type="file"
								accept="image/jpeg,image/png,image/webp,image/gif"
								on:change={handleFileChange}
								class="hidden"
							/>
						</label>
					{/if}

					<!-- Botón enviar -->
					<button
						on:click={subirComprobante}
						disabled={!previewImagen || estado === 'subiendo'}
						class="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
					>
						{#if estado === 'subiendo'}
							<Loader class="w-5 h-5 animate-spin" />
							Enviando...
						{:else}
							<Upload class="w-5 h-5" />
							Enviar comprobante
						{/if}
					</button>
				</div>
			{/if}
		</div>

		<p class="text-xs text-gray-400 text-center mt-4">
			Este link es privado y de un solo uso.
		</p>
	</div>
</div>
