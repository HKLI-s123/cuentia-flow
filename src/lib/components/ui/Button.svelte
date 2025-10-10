<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let fullWidth = false;
  export let loading = false;

  // Clases base del botón
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  // Variantes de color
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 border border-blue-600',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500 border border-gray-300',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 border border-green-600',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 border border-red-600',
    outline: 'bg-transparent text-blue-600 hover:bg-blue-50 focus:ring-blue-500 border border-blue-600',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500 border border-transparent'
  };

  // Tamaños
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5'
  };

  $: classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? 'w-full' : ''
  ].join(' ');
</script>

<button
  {type}
  {disabled}
  class={classes}
  on:click
  {...$$restProps}
>
  {#if loading}
    <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
    <span>Cargando...</span>
  {:else}
    <slot />
  {/if}
</button>
