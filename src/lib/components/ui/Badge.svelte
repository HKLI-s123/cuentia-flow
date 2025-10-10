<script lang="ts">
  export let variant: 'success' | 'warning' | 'danger' | 'info' | 'gray' = 'gray';
  export let size: 'sm' | 'md' | 'lg' = 'md';

  // Clases base
  const baseClasses = 'inline-flex items-center font-medium rounded-full';

  // Variantes de color
  const variantClasses = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-700'
  };

  // Tamaños
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  $: classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size]
  ].join(' ');
</script>

<span class={classes} {...$$restProps}>
  <slot />
</span>
