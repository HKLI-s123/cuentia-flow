import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Store para detectar cambios de organización
// Cada vez que cambie la organización, este contador se incrementa
// y los componentes que lo escuchen se recargarán automáticamente
export const organizacionCambio = writable<number>(0);

// Store reactivo con la información completa de la organización actual
interface OrganizacionActual {
  id: number | null;
  nombre: string | null;
  rolId: number | null;
  rolNombre: string | null;
}

function crearOrganizacionStore() {
  const { subscribe, set } = writable<OrganizacionActual>({
    id: null,
    nombre: null,
    rolId: null,
    rolNombre: null
  });

  return {
    subscribe,
    // Inicializar desde sessionStorage
    init: () => {
      if (browser) {
        try {
          const userData = sessionStorage.getItem('userData');
          if (userData) {
            const user = JSON.parse(userData);
            set({
              id: user.organizacionId || null,
              nombre: user.organizacionNombre || null,
              rolId: user.rolId || null,
              rolNombre: user.rolNombre || null
            });
          }
        } catch (e) {
          console.error('Error al inicializar store de organización:', e);
        }
      }
    },
    // Actualizar cuando cambie la organización
    actualizar: (org: OrganizacionActual) => {
      set(org);
    },
    // Limpiar al hacer logout
    limpiar: () => {
      set({
        id: null,
        nombre: null,
        rolId: null,
        rolNombre: null
      });
    }
  };
}

export const organizacionStore = crearOrganizacionStore();

// Derived store para obtener solo el ID (útil para queries)
export const organizacionId = derived(
  organizacionStore,
  $org => $org.id
);

// Función helper para notificar que cambió la organización
export function notificarCambioOrganizacion() {
  organizacionCambio.update((n: number) => n + 1);
}
