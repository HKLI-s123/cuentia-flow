/**
 * Worker DB - Reutiliza la misma configuración de conexión que la app principal
 * pero con su propio pool para no interferir con las requests HTTP.
 */
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[WORKER] Variable de entorno ${name} no definida`);
  return value;
}

const pool = new Pool({
  user: getEnvVar('DB_USER'),
  password: getEnvVar('DB_PASSWORD'),
  host: getEnvVar('DB_HOST'),
  database: getEnvVar('DB_NAME'),
  port: parseInt(process.env.DB_PORT || '5432'),
});

export async function getConnection(): Promise<pg.Pool> {
  console.log('[WORKER-DB] Conexión a PostgreSQL establecida');
  return pool;
}

export async function closeConnection(): Promise<void> {
  await pool.end();
  console.log('[WORKER-DB] Conexión cerrada');
}

export { pool };
