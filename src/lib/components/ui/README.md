# Sistema de Diseño - Componentes UI

Este directorio contiene todos los componentes UI estandarizados del sistema, siguiendo el concepto de **permanencia** y consistencia visual.

## 🎨 Design Tokens

Los tokens de diseño están centralizados en `/src/lib/design-tokens.ts` e incluyen:

- **Colores**: Primary, Success, Warning, Danger, Gray
- **Espaciado**: Sistema de 8px (1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24)
- **Tipografía**: Tamaños y pesos de fuente
- **Bordes**: Radio de esquinas
- **Sombras**: Niveles de elevación
- **Transiciones**: Duraciones estándar

## 📦 Componentes Disponibles

### Button

Botón estandarizado con múltiples variantes y tamaños.

**Uso:**
```svelte
<script>
  import { Button } from '$lib/components/ui';
</script>

<Button variant="primary" size="md">
  Guardar
</Button>

<Button variant="success" size="lg" loading={true}>
  Enviando...
</Button>

<Button variant="danger" size="sm" disabled>
  Eliminar
</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost'
- `size`: 'sm' | 'md' | 'lg'
- `disabled`: boolean
- `loading`: boolean
- `fullWidth`: boolean
- `type`: 'button' | 'submit' | 'reset'

---

### Badge

Etiquetas para estados, categorías, etc.

**Uso:**
```svelte
<script>
  import { Badge } from '$lib/components/ui';
</script>

<Badge variant="success">Activo</Badge>
<Badge variant="warning">Pendiente</Badge>
<Badge variant="danger">Rechazado</Badge>
```

**Props:**
- `variant`: 'success' | 'warning' | 'danger' | 'info' | 'gray'
- `size`: 'sm' | 'md' | 'lg'

---

### Input

Campo de texto estandarizado con validación.

**Uso:**
```svelte
<script>
  import { Input } from '$lib/components/ui';
  let email = '';
  let errorMsg = '';
</script>

<Input
  type="email"
  label="Correo electrónico"
  bind:value={email}
  error={errorMsg}
  required
  placeholder="usuario@ejemplo.com"
/>
```

**Props:**
- `type`: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
- `value`: string | number
- `label`: string
- `placeholder`: string
- `error`: string
- `disabled`: boolean
- `required`: boolean

---

### Modal

Modal estandarizado con header, body y footer personalizables.

**Uso:**
```svelte
<script>
  import { Modal, Button } from '$lib/components/ui';
  let open = false;
</script>

<Modal
  bind:open
  title="Confirmar acción"
  size="md"
  on:close={() => open = false}
>
  <p>¿Estás seguro de que deseas continuar?</p>

  <svelte:fragment slot="footer">
    <div class="flex gap-3 justify-end">
      <Button variant="secondary" on:click={() => open = false}>
        Cancelar
      </Button>
      <Button variant="primary">
        Confirmar
      </Button>
    </div>
  </svelte:fragment>
</Modal>
```

**Props:**
- `open`: boolean
- `title`: string
- `size`: 'sm' | 'md' | 'lg' | 'xl' | 'full'
- `showCloseButton`: boolean
- `closeOnOverlayClick`: boolean

**Slots:**
- `default`: Contenido principal del modal
- `header-icon`: Icono opcional en el header
- `header-actions`: Acciones adicionales en el header
- `footer`: Footer personalizable

---

## 🎯 Guías de Uso

### 1. Importación

```svelte
<script>
  // Importar componentes individuales
  import { Button, Badge, Input, Modal } from '$lib/components/ui';

  // O importar design tokens
  import { colors, spacing } from '$lib/design-tokens';
</script>
```

### 2. Consistencia de Colores

Usar siempre las variantes definidas:
- **Primary (Azul)**: Acciones principales, links importantes
- **Success (Verde)**: Confirmaciones, estados positivos
- **Warning (Amarillo)**: Advertencias, estados pendientes
- **Danger (Rojo)**: Errores, acciones destructivas
- **Gray**: Acciones secundarias, elementos neutrales

### 3. Espaciado

Usar el sistema de espaciado definido (múltiplos de 4px):
```svelte
<div class="p-4">     <!-- 16px -->
<div class="mt-6">    <!-- 24px -->
<div class="gap-3">   <!-- 12px -->
```

### 4. Tipografía

Tamaños estándar:
- **text-xs**: 12px - Textos pequeños, metadatos
- **text-sm**: 14px - Textos normales, botones
- **text-base**: 16px - Textos principales
- **text-lg**: 18px - Subtítulos
- **text-xl**: 20px - Títulos de secciones
- **text-2xl**: 24px - Títulos de modales

---

## ✅ Checklist de Migración

Al refactorizar componentes existentes:

1. [ ] Reemplazar botones custom por `<Button>`
2. [ ] Reemplazar badges custom por `<Badge>`
3. [ ] Reemplazar inputs custom por `<Input>`
4. [ ] Reemplazar modales custom por `<Modal>`
5. [ ] Verificar consistencia de colores
6. [ ] Verificar consistencia de espaciado
7. [ ] Verificar consistencia tipográfica
8. [ ] Probar funcionalidad
9. [ ] Verificar responsive design

---

## 🚀 Próximos Componentes

- [ ] Select/Dropdown
- [ ] Checkbox
- [ ] Radio
- [ ] Textarea
- [ ] Card
- [ ] Alert
- [ ] Toast/Notification
- [ ] Table
- [ ] Tabs
- [ ] Pagination
