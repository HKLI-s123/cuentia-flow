/**
 * WhatsApp Manager para el Worker
 * 
 * NO abre su propio socket de Baileys (eso lo hace la app web).
 * En su lugar:
 * - Envía mensajes llamando a la API interna de la app web
 * - Consulta la BD para saber qué sesiones están activas
 * - Registra un listener (vía la app web) para mensajes entrantes
 */
import { getConnection } from './db.js';
import { maskPhone } from './security.js';

// ═══════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';

// Tipo para mensajes entrantes
export interface IncomingMessage {
  sessionName: string;
  organizacionId: number;
  from: string;          // JID del remitente
  fromPhone: string;     // Número limpio
  isLid?: boolean;       // true si el JID es de tipo @lid (Linked Identity)
  text: string;          // Contenido del mensaje
  messageId: string;
  timestamp: number;
  isGroup: boolean;
  pushName?: string;     // Nombre del contacto
  imageBase64?: string;  // Imagen en base64 (comprobante de pago)
  imageMimetype?: string; // Tipo MIME de la imagen
  isAudio?: boolean;      // true si el mensaje es audio/nota de voz
}

// Callback para cuando llega un mensaje
type OnMessageCallback = (message: IncomingMessage) => void | Promise<void>;
let onMessageCallback: OnMessageCallback | null = null;

/**
 * Registra el callback global para mensajes entrantes
 */
export function onIncomingMessage(callback: OnMessageCallback): void {
  onMessageCallback = callback;
}

/**
 * Obtiene las sesiones activas desde la base de datos (Organizaciones_BaileysSession)
 */
export async function getActiveSessions(): Promise<Array<{ sessionName: string; organizacionId: number; connected: boolean }>> {
  try {
    const pool = await getConnection();
    const result = await pool.query(`
      SELECT SessionName, OrganizacionId, Estado
      FROM Organizaciones_BaileysSession
      WHERE Activo = true
    `);
    return result.rows.map((r: any) => ({
      sessionName: r.sessionname,
      organizacionId: r.organizacionid,
      connected: true, // Si Activo=true, la sesión está conectada
    }));
  } catch (err) {
    console.error('[WA-WORKER] Error obteniendo sesiones de BD:', err);
    return [];
  }
}

/**
 * Envía un mensaje de WhatsApp a través de la API interna de la app web.
 * Usa un endpoint interno que no requiere auth de usuario.
 */
export async function sendWorkerMessage(
  sessionName: string,
  jid: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(`${APP_BASE_URL}/api/worker/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': process.env.WORKER_SECRET || '',
      },
      body: JSON.stringify({ sessionName, jid, text }),
    });

    if (!response.ok) {
      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw?.slice(0, 180) || 'Respuesta no JSON' };
      }
      return { success: false, error: `${data.error || 'Error'} (HTTP ${response.status})` };
    }

    const data = await response.json();
    return { success: true, messageId: data.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Error de conexión';
    console.error(`[WA-WORKER] Error enviando mensaje via API:`, error);
    return { success: false, error };
  }
}

/**
 * Envía un documento (PDF/XML) por WhatsApp junto con un texto
 */
export async function sendWorkerDocument(
  sessionName: string,
  jid: string,
  text: string,
  documentBase64: string,
  fileName: string,
  mimetype: string = 'application/pdf'
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(`${APP_BASE_URL}/api/worker/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': process.env.WORKER_SECRET || '',
      },
      body: JSON.stringify({ sessionName, jid, text, documentBase64, mimetype, fileName }),
    });

    if (!response.ok) {
      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw?.slice(0, 180) || 'Respuesta no JSON' };
      }
      return { success: false, error: `${data.error || 'Error'} (HTTP ${response.status})` };
    }

    const data = await response.json();
    return { success: true, messageId: data.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Error de conexión';
    console.error(`[WA-WORKER] Error enviando documento via API:`, error);
    return { success: false, error };
  }
}

/**
 * Inicializa las sesiones — en este modelo solo verifica la BD
 */
export async function initAllSessions(): Promise<number> {
  const sessions = await getActiveSessions();
  const connected = sessions.filter(s => s.connected);
  console.log(`[WA-WORKER] ${sessions.length} sesiones en BD, ${connected.length} conectadas`);
  return connected.length;
}

/**
 * Convierte número de teléfono a JID de WhatsApp
 */
export function phoneToJid(phoneNumber: string): string {
  let clean = phoneNumber.replace(/\D/g, '');
  if (clean.length === 10) {
    clean = `521${clean}`;
  } else if (clean.length === 12 && clean.startsWith('52') && !clean.startsWith('521')) {
    clean = `521${clean.substring(2)}`;
  }
  return `${clean}@s.whatsapp.net`;
}

/**
 * Cierra conexiones del worker (solo BD, no Baileys)
 */
export async function closeAllSessions(): Promise<void> {
  console.log('[WA-WORKER] Worker WhatsApp cleanup completo');
}

/**
 * Resuelve un LID (Linked Identity) a un número de teléfono real.
 * Busca en la BD qué cliente de esta org fue contactado hoy por el agente IA.
 */
export async function resolveLidToPhone(organizacionId: number): Promise<string | null> {
  try {
    const pool = await getConnection();
    const result = await pool.query(
			`
        SELECT DISTINCT c.telefonowhatsapp
        FROM GestionesCobranza gc
        INNER JOIN Facturas f ON gc.facturaid = f.id
        INNER JOIN Clientes c ON f.clienteid = c.id
        WHERE c.organizacionid = $1
          AND gc.descripcion LIKE 'AGENTE_IA:%'
          AND COALESCE(f.agenteiaactivo, false) = true
          AND gc.fechagestion::date = CURRENT_DATE
      `,
			[organizacionId]
		);

    if (result.rows.length === 0) {
      console.log(`[WA-WORKER] No se encontró ningún cliente contactado hoy en org ${organizacionId}`);
      return null;
    }

    // Tomar el teléfono (limpiar caracteres)
    const phone = result.rows[0].telefonowhatsapp?.replace(/[\s\-\(\)]/g, '') || null;
    if (result.rows.length > 1) {
      console.log(`[WA-WORKER] Múltiples clientes contactados hoy en org ${organizacionId}, usando el primero: ${maskPhone(phone || '')}`);
    }
    return phone;
  } catch (err) {
    console.error('[WA-WORKER] Error resolviendo LID:', err);
    return null;
  }
}

/**
 * Procesa un mensaje entrante (llamado desde la app web vía el endpoint /api/worker/incoming)
 */
export async function processIncomingMessage(message: IncomingMessage): Promise<void> {
  if (onMessageCallback) {
    await onMessageCallback(message);
  }
}
