import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

export type Cliente = {
  id: number;
  agente: string;
  cliente: string;
  rfc: string;
  condiciones: string;
  cuentasMXN: number;
  cuentasUSD: number;
};

const API = '/api/clientes'; // rutas de +server.ts

export async function cargarClientes(): Promise<Cliente[]> {
  try {
    const res = await fetch(API);
    return await res.json();
  } catch (err) {
    Swal.fire('Error', 'No se pudieron cargar los clientes', 'error');
    return [];
  }
}

export async function agregarCliente(nuevo: Omit<Cliente, 'id'>): Promise<Cliente | null> {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevo)
    });
    const saved: Cliente = await res.json();
    Swal.fire('Éxito', 'Cliente agregado', 'success');
    return saved;
  } catch (err) {
    Swal.fire('Error', 'No se pudo agregar el cliente', 'error');
    return null;
  }
}

export async function guardarEdicion(id: number, updated: Omit<Cliente, 'id'>): Promise<void> {
  try {
    await fetch(`${API}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    Swal.fire('Éxito', 'Cliente actualizado', 'success');
  } catch (err) {
    Swal.fire('Error', 'No se pudo actualizar el cliente', 'error');
  }
}

export async function eliminarCliente(id: number): Promise<void> {
  const result = await Swal.fire({
    title: '¿Seguro?',
    text: 'Este cliente será eliminado',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });
  if (!result.isConfirmed) return;

  try {
    await fetch(`${API}/${id}`, { method: 'DELETE' });
    Swal.fire('Eliminado', 'Cliente eliminado correctamente', 'success');
  } catch (err) {
    Swal.fire('Error', 'No se pudo eliminar el cliente', 'error');
  }
}

export function exportarExcel(clientes: Cliente[]) {
  const ws = XLSX.utils.json_to_sheet(clientes);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, 'clientes.xlsx');
}
