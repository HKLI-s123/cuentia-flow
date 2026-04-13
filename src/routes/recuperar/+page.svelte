<script lang="ts">
import { onMount } from 'svelte';
let email = '';
let error = '';
let success = false;
let csrfToken = '';

async function getCsrfToken() {
	try {
		const res = await fetch('/api/auth/csrf', { method: 'GET', credentials: 'include' });
		const data = await res.json();
		csrfToken = data.csrf_token || '';
	} catch {
		error = 'No se pudo obtener el token CSRF';
	}
}

onMount(() => {
	getCsrfToken();
});

async function submit() {
	if (!email) {
		error = 'Email requerido';
		return;
	}
	// Obtener el token CSRF directamente de la cookie
	const cookieToken = document.cookie
		.split('; ')
		.find(row => row.startsWith('csrf_token='))
		?.split('=')[1] || '';
	if (!cookieToken) {
		error = 'Token CSRF faltante.';
		return;
	}
	const res = await fetch('/api/auth/password-reset/request', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-CSRF-Token': cookieToken
		},
		body: JSON.stringify({ email }),
		credentials: 'include'
	});
	const data = await res.json();
	if (data.success) {
		success = true;
	} else {
		error = data.error || 'Error al enviar email.';
	}
}
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
	<div class="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
		<div class="flex flex-col items-center mb-2">
			<img src="/logotipo-cuentia-flow-black.png" alt="CuentIA Flow" class="w-64 mb-2" />
			<h2 class="text-2xl font-bold text-indigo-900 mb-4">Recuperar contraseña</h2>
			<p class="text-gray-600 text-sm mb-4">Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>
		</div>
		{#if success}
			<p class="text-green-600 text-center font-semibold">Email enviado. Revisa tu bandeja de entrada.</p>
		{:else}
			<form on:submit|preventDefault={submit}>
				<input type="email" placeholder="Correo electrónico" bind:value={email} class="mb-3 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800" />
				{#if error}
					<p class="text-red-600 text-center mb-2">{error}</p>
				{/if}
				<button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">Enviar enlace</button>
			</form>
		{/if}
		<div class="mt-6 text-center">
			<a href="/login" class="text-indigo-600 hover:underline text-sm">Volver al inicio de sesión</a>
		</div>
	</div>
</div>
