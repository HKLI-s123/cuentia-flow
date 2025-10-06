<script lang="ts">
  import '../app.css';
  import favicon from '$lib/assets/favicon.svg';
</script>

<svelte:head>
  <link rel="icon" href="/favicon.ico" />
</svelte:head>

<!-- Layout principal pegado a la izquierda -->
<div class="bg-gray-100">
  <!-- Contenido de la página -->
  <slot />
</div>
