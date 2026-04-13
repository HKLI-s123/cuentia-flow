<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';
import { PasswordInput } from '$lib/components/ui';

let password = '';
let confirm = '';
let error = '';
let success = false;

async function submit() {
	error = '';
	if (!password || password.length < 8) {
		error = 'La nueva contraseña debe tener al menos 8 caracteres.';
		return;
	}
	if (password !== confirm) {
		error = 'Las contraseñas no coinciden.';
		return;
	}
	const token = get(page).params.token;
	// Obtener el token CSRF directamente de la cookie
	const cookieToken = document.cookie
		.split('; ')
		.find(row => row.startsWith('csrf_token='))
		?.split('=')[1] || '';
	if (!cookieToken) {
		error = 'No se pudo validar tu sesión. Recarga la página e inténtalo de nuevo.';
		return;
	}
	try {
		const res = await fetch(`/api/auth/password-reset/reset`, {
			method: 'POST',
			body: JSON.stringify({ token, contrasena: password }),
			headers: {
				'Content-Type': 'application/json',
				'X-CSRF-Token': cookieToken
			},
			credentials: 'include'
		});
		const data = await res.json();
		if (data.success) {
			success = true;
			setTimeout(() => goto('/login'), 2000);
		} else if (data.error && data.error.includes('expirado')) {
			error = 'El enlace para restablecer la contraseña ha expirado. Solicita uno nuevo.';
		} else if (data.error && data.error.includes('inválido')) {
			error = 'El enlace de restablecimiento no es válido. Solicita uno nuevo.';
		} else {
			error = data.error || 'No se pudo cambiar la contraseña. Intenta nuevamente.';
		}
	} catch (e) {
		error = 'Ocurrió un error inesperado. Intenta nuevamente.';
	}
}
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
	<div class="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
		<div class="flex flex-col items-center mb-6">
			<img src="/logo-cuentia-flow.png" alt="CuentIA Flow" class="w-32 mb-2" />
			<h2 class="text-2xl font-bold text-indigo-900 mb-2">Restablecer contraseña</h2>
			<p class="text-gray-600 text-sm mb-4">Ingresa tu nueva contraseña para tu cuenta.</p>
		</div>
		{#if success}
			<p class="text-green-600 text-center font-semibold">Contraseña cambiada exitosamente. Redirigiendo...</p>
		{:else}
			<form on:submit|preventDefault={submit}>
				<PasswordInput
					id="new-password"
					label="Nueva contraseña"
					bind:value={password}
					placeholder="Nueva contraseña"
					required
				/>
				<div class="mt-3">
					<PasswordInput
						id="confirm-password"
						label="Confirmar contraseña"
						bind:value={confirm}
						placeholder="Confirmar contraseña"
						required
					/>
				</div>
				{#if error}
					<p class="text-red-600 text-center mb-2">{error}</p>
				{/if}
				<button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">Cambiar contraseña</button>
			</form>
		{/if}
		<div class="mt-6 text-center">
			<a href="/login" class="text-indigo-600 hover:underline text-sm">Volver al inicio de sesión</a>
		</div>
	</div>
</div>
