<script>
  import { goto } from '$app/navigation';
</script>

<div class="flex min-h-screen justify-center items-center bg-gray-50">
  <div class="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md text-center">
    <h1 class="text-3xl font-bold mb-6 text-green-600">¡Cuenta verificada!</h1>
    <p class="text-gray-700 mb-6">Tu correo ha sido verificado correctamente.<br>Ya puedes iniciar sesión en la plataforma.</p>
    <button class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition" on:click={() => goto('/login')}>
      Iniciar sesión
    </button>
  </div>
</div>
