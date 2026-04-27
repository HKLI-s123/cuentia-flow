import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { validateOrganizationAccess } from '$lib/server/auth';

const MAX_NOMBRE = 100;
const MAX_CONTENIDO = 1000;
const MAX_PLANTILLAS = 50;

function parseInt10(val: string | null): number | null {
  if (!val) return null;
  const n = parseInt(val, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

export const GET: RequestHandler = async (event) => {
  const orgId = parseInt10(event.url.searchParams.get('organizacionId'));
  if (!orgId) return json({ error: 'organizacionId inválido' }, { status: 400 });

  const auth = await validateOrganizationAccess(event, orgId);
  if (!auth.valid) return auth.error!;

  try {
    const rows = await db.query(
      `SELECT Id as id, Nombre as nombre, Contenido as contenido, CreatedAt as "createdAt"
       FROM PlantillasNotas
       WHERE OrganizacionId = $1
       ORDER BY Nombre ASC`,
      [orgId]
    );
    return json({ plantillas: rows });
  } catch {
    return json({ error: 'Error al obtener plantillas' }, { status: 500 });
  }
};

export const POST: RequestHandler = async (event) => {
  // Validate content-type
  const ct = event.request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return json({ error: 'Content-Type debe ser application/json' }, { status: 415 });
  }

  let body: any;
  try {
    body = await event.request.json();
  } catch {
    return json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const { organizacionId, nombre, contenido } = body ?? {};

  const orgId = parseInt10(String(organizacionId ?? ''));
  if (!orgId) return json({ error: 'organizacionId inválido' }, { status: 400 });

  const nombreLimpio = typeof nombre === 'string' ? nombre.trim().substring(0, MAX_NOMBRE) : '';
  const contenidoLimpio = typeof contenido === 'string' ? contenido.trim().substring(0, MAX_CONTENIDO) : '';

  if (!nombreLimpio) return json({ error: 'El nombre es requerido (máx. 100 caracteres)' }, { status: 400 });
  if (!contenidoLimpio) return json({ error: 'El contenido es requerido (máx. 1000 caracteres)' }, { status: 400 });

  const auth = await validateOrganizationAccess(event, orgId);
  if (!auth.valid) return auth.error!;

  try {
    // Enforce per-org limit
    const count = await db.queryOne(
      'SELECT COUNT(*) as cnt FROM PlantillasNotas WHERE OrganizacionId = $1',
      [orgId]
    );
    if (parseInt(count?.cnt ?? '0', 10) >= MAX_PLANTILLAS) {
      return json({ error: `Límite de ${MAX_PLANTILLAS} plantillas por organización alcanzado` }, { status: 400 });
    }

    // Prevent duplicate names in the same org
    const duplicate = await db.queryOne(
      'SELECT Id FROM PlantillasNotas WHERE OrganizacionId = $1 AND LOWER(Nombre) = LOWER($2)',
      [orgId, nombreLimpio]
    );
    if (duplicate) {
      return json({ error: 'Ya existe una plantilla con ese nombre' }, { status: 409 });
    }

    const rows = await db.query(
      `INSERT INTO PlantillasNotas (OrganizacionId, Nombre, Contenido)
       VALUES ($1, $2, $3)
       RETURNING Id as id, Nombre as nombre, Contenido as contenido, CreatedAt as "createdAt"`,
      [orgId, nombreLimpio, contenidoLimpio]
    );

    return json({ success: true, plantilla: rows[0] }, { status: 201 });
  } catch {
    return json({ error: 'Error al guardar plantilla' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async (event) => {
  const id = parseInt10(event.url.searchParams.get('id'));
  const orgId = parseInt10(event.url.searchParams.get('organizacionId'));
  if (!id || !orgId) return json({ error: 'id y organizacionId inválidos' }, { status: 400 });

  const auth = await validateOrganizationAccess(event, orgId);
  if (!auth.valid) return auth.error!;

  try {
    await db.query(
      'DELETE FROM PlantillasNotas WHERE Id = $1 AND OrganizacionId = $2',
      [id, orgId]
    );
    return json({ success: true });
  } catch {
    return json({ error: 'Error al eliminar plantilla' }, { status: 500 });
  }
};
