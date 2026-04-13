import { Boom } from '@hapi/boom';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import pino from 'pino';
import { env } from '$env/dynamic/private';

// Importar dinámicamente @whiskeysockets/baileys
let cachedModules: any = null;

async function getBaileysModules() {
	if (cachedModules) return cachedModules;

	const mod: any = await import('@whiskeysockets/baileys');
	cachedModules = {
		makeWASocket: mod.makeWASocket || mod.default,
		useMultiFileAuthState: mod.useMultiFileAuthState,
		DisconnectReason: mod.DisconnectReason,
		Browsers: mod.Browsers,
		fetchLatestBaileysVersion: mod.fetchLatestBaileysVersion,
		downloadMediaMessage: mod.downloadMediaMessage
	};
	return cachedModules;
}

// Almacenamiento en memoria de conexiones activas
const activeSessions = new Map<string, {
	socket: any;
	sessionName: string;
	lastActivity: Date;
	qrGenerated: boolean;
	authError?: string;
}>();

// Contador de reintentos GLOBAL por sesión (no se reinicia al recrear)
const reconnectCounters = new Map<string, number>();
const MAX_RECONNECTS = 5;

/**
 * Obtiene o crea el directorio de autenticación para una organización
 */
function getAuthPath(sessionName: string): string {
	const authDir = path.join(process.cwd(), '.whatsapp', 'auth_info', sessionName);
	if (!existsSync(authDir)) {
		mkdirSync(authDir, { recursive: true });
	}
	return authDir;
}

/**
 * Elimina los archivos de autenticación de una sesión para permitir generar nuevo QR
 */
function cleanSessionFiles(sessionName: string): void {
	const authDir = path.join(process.cwd(), '.whatsapp', 'auth_info', sessionName);
	if (existsSync(authDir)) {
		try {
			rmSync(authDir, { recursive: true, force: true });
		} catch (err) {
			console.error(`[BAILEYS] Error eliminando auth files:`, err);
		}
	}
}

/**
 * Actualiza el estado de la sesión en BD a desconectado
 */
async function markSessionDisconnectedInDB(sessionName: string): Promise<void> {
	try {
		// Extraer organizacionId del sessionName (formato: org_XX_session)
		const match = sessionName.match(/org_(\d+)_session/);
		if (!match) return;

		const organizacionId = parseInt(match[1]);
		const { getConnection } = await import('$lib/server/db');
		const pool = await getConnection();

		await pool
			.query(
			`
				UPDATE Organizaciones_BaileysSession
				SET Activo = false, Estado = 'desconectado', UltimaActividad = NOW()
				WHERE OrganizacionId = $1
			`,
			[organizacionId]
		);

	} catch (err) {
		console.error(`[BAILEYS] Error actualizando BD al desconectar:`, err);
	}
}

/**
 * Inicia una sesión de Baileys para una organización
 */
export async function initializeBaileysSession(
	sessionName: string,
	onQR?: (qrString: string) => void,
	onAuthError?: (error: string) => void
): Promise<any | null> {
	try {
		// Obtener módulos de Baileys
		const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = await getBaileysModules();

		// Verificar si ya existe una sesión activa
		if (activeSessions.has(sessionName)) {
			const session = activeSessions.get(sessionName);
			if (session?.socket?.user) {
				return session.socket;
			}
			// Si hay sesión pero no está autenticada, limpiar antes de crear nueva
			if (session?.socket) {
				try { 
					if (session.socket.ws) session.socket.ws.close();
				} catch (_) { /* ignore */ }
			}
			activeSessions.delete(sessionName);
		}

		// Verificar límite de reintentos
		const attempts = reconnectCounters.get(sessionName) || 0;
		if (attempts >= MAX_RECONNECTS) {
			if (onAuthError) onAuthError('Máximo de reintentos alcanzado. Intenta de nuevo.');
			reconnectCounters.delete(sessionName);
			return null;
		}

		const authPath = getAuthPath(sessionName);
		const { state, saveCreds } = await useMultiFileAuthState(authPath);

		// Obtener versión actual
		const { version } = await fetchLatestBaileysVersion();
		const socket = makeWASocket({
			auth: state,
			printQRInTerminal: false,
			logger: pino({ level: 'silent' }),
			browser: Browsers.appropriate('Desktop'),
			version,
			connectTimeoutMs: 60000,
			defaultQueryTimeoutMs: 0
		});

		// Escuchar cambios en la conexión
		socket.ev.on('connection.update', async (update: any) => {
			const { connection, lastDisconnect, qr } = update;

			// Si hay QR, emitir al cliente
			if (qr) {
				reconnectCounters.set(sessionName, 0); // Reset si genera QR
				if (onQR) {
					onQR(qr);
				}
				const session = activeSessions.get(sessionName);
				if (session) {
					session.qrGenerated = true;
				}
			}

			if (connection === 'close') {
				const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
				const currentAttempts = (reconnectCounters.get(sessionName) || 0) + 1;
				reconnectCounters.set(sessionName, currentAttempts);

				const isLoggedOut = statusCode === DisconnectReason.loggedOut;
				const shouldReconnect = !isLoggedOut && currentAttempts < MAX_RECONNECTS;
				
				if (isLoggedOut) {
					// Teléfono desconectado o sesión cerrada desde el dispositivo
					activeSessions.delete(sessionName);
					reconnectCounters.delete(sessionName);
					cleanSessionFiles(sessionName);
					await markSessionDisconnectedInDB(sessionName);
					if (onAuthError) {
						onAuthError('Sesión cerrada desde el dispositivo. Genera un nuevo QR para reconectar.');
					}
				} else if (shouldReconnect) {
					const delay = Math.min(3000 * currentAttempts, 15000);
					setTimeout(() => {
						initializeBaileysSession(sessionName, onQR, onAuthError);
					}, delay);
				} else {
					activeSessions.delete(sessionName);
					reconnectCounters.delete(sessionName);
					cleanSessionFiles(sessionName);
					await markSessionDisconnectedInDB(sessionName);
					if (onAuthError) {
						onAuthError('No se pudo conectar a WhatsApp. Genera un nuevo QR.');
					}
				}
			} else if (connection === 'open') {
				reconnectCounters.set(sessionName, 0);
				const session = activeSessions.get(sessionName);
				if (session) {
					session.lastActivity = new Date();
					session.authError = undefined;
				}
			}
		});

		// Escuchar cambios de credenciales (guardar)
		socket.ev.on('creds.update', () => {
			saveCreds();
		});

		// ═══ Listener de mensajes entrantes → reenviar al Worker ═══
		socket.ev.on('messages.upsert', async (upsert: any) => {
			if (upsert.type !== 'notify') return;

			const workerUrl = env.WORKER_URL || 'http://localhost:3847';
			const workerSecret = env.WORKER_SECRET || '';
			const { downloadMediaMessage } = await getBaileysModules();

			for (const msg of upsert.messages) {
				if (msg.key.fromMe) continue;
				if (msg.key.remoteJid?.endsWith('@g.us')) continue;
				if (msg.key.remoteJid === 'status@broadcast') continue;

				const text = msg.message?.conversation
					|| msg.message?.extendedTextMessage?.text
					|| msg.message?.imageMessage?.caption
					|| '';

				// Detectar si es una imagen
				const imageMessage = msg.message?.imageMessage;
				let imageBase64: string | undefined;
				let imageMimetype: string | undefined;

				if (imageMessage) {
					try {
						const buffer = await downloadMediaMessage(
							msg,
							'buffer',
							{},
							{
								logger: pino({ level: 'silent' }),
								reuploadRequest: socket.updateMediaMessage
							}
						);
						if (buffer && buffer.length > 0) {
							// Limitar a 5MB para no sobrecargar
							if (buffer.length <= 5 * 1024 * 1024) {
								imageBase64 = buffer.toString('base64');
								imageMimetype = imageMessage.mimetype || 'image/jpeg';
							} else {
							}
						}
					} catch (imgErr) {
						console.error(`[BAILEYS] Error descargando imagen:`, imgErr);
					}
				}

				// Detectar si es un audio/nota de voz
				const isAudio = !!(msg.message?.audioMessage || msg.message?.pttMessage);

				// Si no hay texto ni imagen ni audio, ignorar
				if (!text.trim() && !imageBase64 && !isAudio) continue;

				const fromJid = msg.key.remoteJid || '';
				const isLid = fromJid.endsWith('@lid');
				const fromPhone = fromJid.replace('@s.whatsapp.net', '').replace('@lid', '');
				const orgMatch = sessionName.match(/org_(\d+)_session/);
				const organizacionId = orgMatch ? parseInt(orgMatch[1]) : 0;

				if (!organizacionId) continue;

				try {
					await fetch(`${workerUrl}/incoming`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-Worker-Secret': workerSecret,
						},
						body: JSON.stringify({
							sessionName,
							organizacionId,
							from: fromJid,
							fromPhone,
							isLid,
							text: text.trim(),
							messageId: msg.key.id || '',
							timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) : Date.now() / 1000,
							isGroup: false,
							pushName: msg.pushName || undefined,
							imageBase64,
							imageMimetype,
							isAudio,
						}),
					});
				} catch (err) {
					// Worker no disponible, no pasa nada — el mensaje se pierde
					// pero se puede procesar después al revisar el historial
				}
			}
		});

		// Guardar sesión en memoria
		activeSessions.set(sessionName, {
			socket,
			sessionName,
			lastActivity: new Date(),
			qrGenerated: false
		});

		return socket;

	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
		console.error(`[BAILEYS] Error inicializando sesión ${sessionName}:`, errorMsg);
		
		if (onAuthError) {
			onAuthError(errorMsg);
		}
		
		const session = activeSessions.get(sessionName);
		if (session) {
			session.authError = errorMsg;
		}
		
		return null;
	}
}

/**
 * Obtiene una sesión activa
 */
export function getSession(sessionName: string): any | null {
	const session = activeSessions.get(sessionName);
	return session?.socket || null;
}

/**
 * Obtiene una sesión activa, o la restaura desde disco si hay auth files guardados.
 * Usar esta función cuando se necesita enviar mensajes.
 */
export async function getOrRestoreSession(sessionName: string): Promise<any | null> {
	// 1. Verificar si ya está en memoria
	const session = activeSessions.get(sessionName);
	if (session?.socket?.user) {
		return session.socket;
	}

	// 2. Verificar si hay auth files en disco (sesión persistida de antes del restart)
	const authPath = path.join(process.cwd(), '.whatsapp', 'auth_info', sessionName);
	const credsPath = path.join(authPath, 'creds.json');

	if (!existsSync(credsPath)) {
		return null;
	}

	// 3. Re-inicializar la sesión desde los auth files guardados
	try {
		const socket = await initializeBaileysSession(sessionName);

		if (!socket) {
			return null;
		}

		// 4. Esperar a que se conecte (máx 15 segundos)
		const maxWait = 15000;
		const interval = 500;
		let waited = 0;

		while (waited < maxWait) {
			if (socket.user) {
				return socket;
			}
			await new Promise(resolve => setTimeout(resolve, interval));
			waited += interval;
		}

		return socket; // Devolver de todas formas, puede que conecte después
	} catch (err) {
		console.error(`[BAILEYS] Error restaurando sesión ${sessionName}:`, err);
		return null;
	}
}

/**
 * Envía un mensaje de WhatsApp
 */
export async function sendMessage(
	sessionName: string,
	jid: string,           // Ej: "5212345678@s.whatsapp.net"
	message: {
		text: string;
		caption?: string;
		document?: Buffer;  // Para PDF/archivo
		fileName?: string;
		mimetype?: string;
	}
): Promise<{ success: boolean; messageId?: string; error?: string }> {
	const attemptSend = async (socket: any): Promise<any> => {
		if (message.document) {
			// 1. Enviar mensaje de texto completo
			await socket.sendMessage(jid, {
				text: message.text
			});

			// 2. Enviar documento
			return await socket.sendMessage(jid, {
				document: message.document,
				mimetype: message.mimetype || 'application/pdf',
				fileName: message.fileName || 'documento.pdf'
			});
		} else {
			// Mensaje de texto simple
			return await socket.sendMessage(jid, {
				text: message.text
			});
		}
	};

	try {
		// Usar getOrRestoreSession en vez de getSession para auto-restaurar
		let socket = await getOrRestoreSession(sessionName);
		
		if (!socket) {
			return {
				success: false,
				error: 'Sesión no encontrada o no conectada'
			};
		}

		if (!socket.user) {
			return {
				success: false,
				error: 'Sesión no autenticada'
			};
		}

		let result;
		try {
			result = await attemptSend(socket);
		} catch (sendError: any) {
			const errMsg = sendError?.message || '';
			// Si falla por conexión cerrada, intentar restaurar sesión y reintentar una vez
			if (errMsg.includes('Connection Closed') || errMsg.includes('connection closed') || errMsg.includes('not open')) {
				console.warn(`[BAILEYS] Conexión cerrada al enviar. Restaurando sesión ${sessionName}...`);
				
				// Limpiar sesión de memoria para forzar reconexión
				activeSessions.delete(sessionName);
				
				// Intentar restaurar
				socket = await getOrRestoreSession(sessionName);
				if (!socket || !socket.user) {
					return {
						success: false,
						error: 'No se pudo reconectar WhatsApp. Verifica la conexión en Configuración.'
					};
				}

				result = await attemptSend(socket);
			} else {
				throw sendError;
			}
		}

		if (!result || !result.key || !result.key.id) {
			return {
				success: false,
				error: 'Error al enviar mensaje: respuesta vacía'
			};
		}

		return {
			success: true,
			messageId: result.key.id || undefined
		};

	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
		console.error(`[BAILEYS] Error enviando mensaje:`, errorMsg);
		
		return {
			success: false,
			error: errorMsg
		};
	}
}

/**
 * Obtiene el estado de una sesión
 */
export function getSessionStatus(sessionName: string): {
	status: 'pendiente' | 'activo' | 'error' | 'no_encontrado';
	telefono?: string;
	ultimaActividad?: string;
	error?: string;
} {
	const session = activeSessions.get(sessionName);

	if (!session) {
		return { status: 'no_encontrado' };
	}

	if (session.authError) {
		return {
			status: 'error',
			error: session.authError
		};
	}

	if (session.socket?.user) {
		// El JID puede venir como "521234567890:123@s.whatsapp.net", limpiamos
		const rawId = session.socket.user.id || '';
		const telefono = rawId.split(':')[0].split('@')[0];
		return {
			status: 'activo',
			telefono,
			ultimaActividad: session.lastActivity.toISOString()
		};
	}

	if (session.qrGenerated) {
		return { status: 'pendiente' };
	}

	return { status: 'pendiente' };
}

/**
 * Cierra/desconecta una sesión
 */
export async function closeSession(sessionName: string): Promise<void> {
	try {
		const session = activeSessions.get(sessionName);
		
		if (session?.socket) {
			try {
				await session.socket.logout();
			} catch (logoutErr) {
				// Si logout falla, cerrar websocket directamente
				try {
					if (session.socket.ws) session.socket.ws.close();
				} catch (_) { /* ignore */ }
			}
		}

		activeSessions.delete(sessionName);
		reconnectCounters.delete(sessionName);
		cleanSessionFiles(sessionName);
	} catch (error) {
		console.error(`[BAILEYS] Error cerrando sesión:`, error);
	}
}

/**
 * Convierte un número de teléfono a JID de WhatsApp
 */
export function phoneToJid(phoneNumber: string, codigoPais?: string): string {
	// Remover caracteres especiales
	let cleanNumber = phoneNumber.replace(/\D/g, '');

	// Si el número no empieza con código de país, agregarlo
	// México: números de 10 dígitos necesitan prefijo 521
	if (cleanNumber.length === 10) {
		const prefix = codigoPais ? codigoPais.replace(/\D/g, '') : '52';
		// Para México (52), WhatsApp requiere 521 + 10 dígitos
		if (prefix === '52') {
			cleanNumber = `521${cleanNumber}`;
		} else {
			cleanNumber = `${prefix}${cleanNumber}`;
		}
	} else if (cleanNumber.length === 12 && cleanNumber.startsWith('52') && !cleanNumber.startsWith('521')) {
		// Si es 52 + 10 dígitos (sin el 1), agregar el 1
		cleanNumber = `521${cleanNumber.substring(2)}`;
	}

	// WhatsApp JID format
	return `${cleanNumber}@s.whatsapp.net`;
}

/**
 * Extrae número de teléfono del JID
 */
export function jidToPhone(jid: string): string {
	return jid.replace('@s.whatsapp.net', '');
}
