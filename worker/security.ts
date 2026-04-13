/**
 * Módulo de Seguridad del Worker - CuentIA Flow
 * 
 * Protecciones:
 * - Comparación de secretos resistente a timing attacks
 * - Rate limiting por IP en el endpoint HTTP
 * - Validación de payloads entrantes
 * - Enmascaramiento de datos sensibles en logs
 * - Límites de tamaño de body
 */
import crypto from 'crypto';

// ═══════════════════════════════════════
// 1. COMPARACIÓN SEGURA DE SECRETOS
// ═══════════════════════════════════════

/**
 * Compara dos strings de forma resistente a timing attacks.
 * Usa crypto.timingSafeEqual internamente.
 */
export function secureCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  // Si tienen longitudes diferentes, aún hacemos la comparación
  // para no revelar la diferencia de longitud por timing
  if (bufA.length !== bufB.length) {
    // Comparar contra sí mismo para consumir el mismo tiempo
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

// ═══════════════════════════════════════
// 2. RATE LIMITER POR IP
// ═══════════════════════════════════════

interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000;  // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 30;   // máximo 30 requests por minuto

/**
 * Verifica si una IP ha excedido el rate limit.
 * Retorna true si se permite, false si se bloquea.
 */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || (now - entry.firstRequest) > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return true;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  return true;
}

// Limpiar entries expirados cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if ((now - entry.firstRequest) > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 300_000);

// ═══════════════════════════════════════
// 3. VALIDACIÓN DE PAYLOADS
// ═══════════════════════════════════════

/**
 * Valida la estructura de un mensaje entrante del worker.
 * Retorna null si es válido, o un string con el error.
 */
export function validateIncomingMessage(data: any): string | null {
  if (!data || typeof data !== 'object') {
    return 'Payload debe ser un objeto JSON';
  }

  if (typeof data.sessionName !== 'string' || data.sessionName.length === 0 || data.sessionName.length > 100) {
    return 'sessionName inválido';
  }

  // Validar sessionName: solo alfanuméricos, guiones bajos y guiones
  if (!/^[a-zA-Z0-9_\-]+$/.test(data.sessionName)) {
    return 'sessionName contiene caracteres no permitidos';
  }

  if (typeof data.organizacionId !== 'number' || !Number.isInteger(data.organizacionId) || data.organizacionId <= 0) {
    return 'organizacionId inválido';
  }

  if (typeof data.from !== 'string' || data.from.length === 0 || data.from.length > 100) {
    return 'from (JID) inválido';
  }

  if (typeof data.fromPhone !== 'string' || data.fromPhone.length === 0 || data.fromPhone.length > 30) {
    return 'fromPhone inválido';
  }

  if (typeof data.text !== 'string') {
    return 'text debe ser string';
  }

  // Limitar tamaño del texto (protección anti-abuse)
  if (data.text.length > 5000) {
    return 'text excede el tamaño máximo (5000 caracteres)';
  }

  if (typeof data.messageId !== 'string' || data.messageId.length === 0 || data.messageId.length > 200) {
    return 'messageId inválido';
  }

  if (typeof data.timestamp !== 'number') {
    return 'timestamp inválido';
  }

  if (typeof data.isGroup !== 'boolean') {
    return 'isGroup debe ser boolean';
  }

  // Los grupos no se procesan
  if (data.isGroup === true) {
    return 'Mensajes de grupo no se procesan';
  }

  // Validar campos opcionales de imagen
  if (data.imageBase64 !== undefined) {
    if (typeof data.imageBase64 !== 'string') {
      return 'imageBase64 debe ser string';
    }
    if (data.imageBase64.length > MAX_DOCUMENT_BASE64_SIZE) {
      return 'Imagen excede el tamaño máximo';
    }
  }

  if (data.imageMimetype !== undefined) {
    if (typeof data.imageMimetype !== 'string') {
      return 'imageMimetype debe ser string';
    }
    // Solo aceptar tipos MIME de imagen válidos
    if (!/^image\/(jpeg|png|webp|gif)$/.test(data.imageMimetype)) {
      return 'imageMimetype no es un tipo de imagen válido';
    }
  }

  return null; // válido
}

/**
 * Valida un JID de WhatsApp
 */
export function validateJid(jid: string): boolean {
  if (!jid || typeof jid !== 'string') return false;
  // JIDs válidos: número@s.whatsapp.net o número@lid
  return /^\d+@(s\.whatsapp\.net|lid)$/.test(jid);
}

// ═══════════════════════════════════════
// 4. ENMASCARAMIENTO DE LOGS
// ═══════════════════════════════════════

/**
 * Enmascara un número de teléfono para logs
 * "6564053919" → "656****919"
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return '***';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 6) return '***';
  return clean.substring(0, 3) + '****' + clean.substring(clean.length - 3);
}

/**
 * Enmascara un secreto para logs
 * "a7f3c9e1b2d4..." → "a7f3****"
 */
export function maskSecret(secret: string): string {
  if (!secret || secret.length < 8) return '****';
  return secret.substring(0, 4) + '****';
}

// ═══════════════════════════════════════
// 5. LÍMITES Y CONSTANTES DE SEGURIDAD
// ═══════════════════════════════════════

/** Tamaño máximo del body HTTP en bytes (8 MB - para aceptar imágenes de comprobantes de pago) */
export const MAX_BODY_SIZE = 8_388_608;

/** Tamaño máximo de documentos base64 (5 MB en base64 ≈ 6.67 MB encoded) */
export const MAX_DOCUMENT_BASE64_SIZE = 7_000_000;

/** Timeout para requests HTTP entrantes (30 segundos) */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Timeout para conexiones idle (60 segundos) */
export const IDLE_TIMEOUT_MS = 60_000;

// ═══════════════════════════════════════
// 6. VALIDACIÓN DE AI RESPONSE
// ═══════════════════════════════════════

const VALID_INTENTS = [
  'confirma_pago', 'promesa_pago', 'solicita_info', 'disputa',
  'solicita_plan_pagos', 'no_puede_pagar', 'saludo_general',
  'no_relevante', 'solicita_hablar_humano'
];

/**
 * Valida y sanitiza la respuesta del modelo de IA.
 * Previene que un modelo comprometido inyecte datos maliciosos.
 */
export function validateAIResponse(data: any): any {
  if (!data || typeof data !== 'object') {
    return null;
  }

  // Validar intent
  if (!VALID_INTENTS.includes(data.intent)) {
    data.intent = 'no_relevante';
    data.requiereHumano = true;
  }

  // Forzar confidence a rango 0-1
  if (typeof data.confidence !== 'number' || isNaN(data.confidence)) {
    data.confidence = 0.3;
  }
  data.confidence = Math.max(0, Math.min(1, data.confidence));

  // Validar fechaPago
  if (data.fechaPago !== null && data.fechaPago !== undefined) {
    if (typeof data.fechaPago !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.fechaPago)) {
      data.fechaPago = undefined;
    } else {
      const d = new Date(data.fechaPago);
      if (isNaN(d.getTime())) {
        data.fechaPago = undefined;
      }
    }
  }

  // Validar montoPago
  if (data.montoPago !== null && data.montoPago !== undefined) {
    if (typeof data.montoPago !== 'number' || isNaN(data.montoPago) || data.montoPago < 0 || data.montoPago > 100_000_000) {
      data.montoPago = undefined;
    }
  }

  // Sanitizar resumen (max 500 chars, strip control chars)
  if (typeof data.resumen === 'string') {
    data.resumen = data.resumen.substring(0, 500).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  } else {
    data.resumen = 'Sin resumen';
  }

  // requiereHumano debe ser boolean
  data.requiereHumano = !!data.requiereHumano;

  // Sanitizar respuestaSugerida (max 1000 chars)
  if (data.respuestaSugerida !== null && data.respuestaSugerida !== undefined) {
    if (typeof data.respuestaSugerida !== 'string') {
      data.respuestaSugerida = undefined;
    } else {
      data.respuestaSugerida = data.respuestaSugerida
        .substring(0, 1000)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }
  }

  // Validar documentosSolicitados
  if (data.documentosSolicitados !== null && data.documentosSolicitados !== undefined) {
    if (!Array.isArray(data.documentosSolicitados)) {
      data.documentosSolicitados = undefined;
    } else {
      data.documentosSolicitados = data.documentosSolicitados.filter(
        (d: any) => d === 'pdf' || d === 'xml'
      );
      if (data.documentosSolicitados.length === 0) {
        data.documentosSolicitados = undefined;
      }
    }
  }

  // Validar facturaNumeroSolicitada (max 50 chars, solo alfanuméricos y guiones)
  if (data.facturaNumeroSolicitada !== null && data.facturaNumeroSolicitada !== undefined) {
    if (typeof data.facturaNumeroSolicitada !== 'string') {
      data.facturaNumeroSolicitada = undefined;
    } else {
      data.facturaNumeroSolicitada = data.facturaNumeroSolicitada
        .substring(0, 50)
        .replace(/[^a-zA-Z0-9\-_ ]/g, '')
        .trim();
      if (!data.facturaNumeroSolicitada) {
        data.facturaNumeroSolicitada = undefined;
      }
    }
  }

  return data;
}
