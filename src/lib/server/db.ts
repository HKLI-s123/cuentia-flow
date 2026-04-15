import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

function getEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`La variable de entorno ${name} no está definida`);
    return value;
}

const pool = new Pool({
    user: getEnvVar('DB_USER'),
    password: getEnvVar('DB_PASSWORD'),
    host: getEnvVar('DB_HOST'),
    database: getEnvVar('DB_NAME'),
    port: parseInt(process.env.DB_PORT || '5432')
});

export async function getConnection() {
    return pool;
}

function normalizeSqlForPostgres(sqlText: string): string {
    let normalized = sqlText;

    // Common MSSQL functions/clauses still present in legacy endpoints.
    normalized = normalized.replace(/\bGETDATE\(\)/gi, 'NOW()');
    normalized = normalized.replace(/\bISNULL\s*\(/gi, 'COALESCE(');
    normalized = normalized.replace(/\bOUTPUT\s+INSERTED\.Id\b/gi, 'RETURNING id');

    normalized = normalized.replace(
        /DATEDIFF\s*\(\s*day\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/gi,
        '($2::date - $1::date)'
    );

    // Convert legacy '?' placeholders to pg positional parameters ($1, $2, ...).
    let result = '';
    let inString = false;
    let paramIndex = 0;

    for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];

        if (ch === "'") {
            result += ch;

            // Escaped single quote inside SQL string literal.
            if (inString && normalized[i + 1] === "'") {
                result += normalized[i + 1];
                i++;
                continue;
            }

            inString = !inString;
            continue;
        }

        if (!inString && ch === '?') {
            paramIndex++;
            result += `$${paramIndex}`;
            continue;
        }

        result += ch;
    }

    return result;
}

function normalizePropertyName(key: string): string {
    return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function createCaseInsensitiveRow(row: Record<string, any>): Record<string, any> {
    const lookup = new Map<string, string>();

    for (const key of Object.keys(row)) {
        const normalized = normalizePropertyName(key);
        if (!lookup.has(normalized)) {
            lookup.set(normalized, key);
        }
    }

    return new Proxy(row, {
        get(target, prop, receiver) {
            if (typeof prop !== 'string') {
                return Reflect.get(target, prop, receiver);
            }

            if (Reflect.has(target, prop)) {
                return Reflect.get(target, prop, receiver);
            }

            const mappedKey = lookup.get(normalizePropertyName(prop));
            if (mappedKey) {
                return (target as any)[mappedKey];
            }

            return undefined;
        }
    });
}

// Objeto db para usar en las APIs
export const db = {
    async query(text: string, params: any[] = []): Promise<any[]> {
        const normalizedText = normalizeSqlForPostgres(text);
        const result = await pool.query(normalizedText, params);
        return result.rows.map((row: any) => createCaseInsensitiveRow(row as Record<string, any>));
    },

    async queryOne(text: string, params: any[] = []): Promise<any | null> {
        const normalizedText = normalizeSqlForPostgres(text);
        const result = await pool.query(normalizedText, params);
        if (!result.rows[0]) {
            return null;
        }

        return createCaseInsensitiveRow(result.rows[0] as Record<string, any>);
    },

    async queryRaw(text: string, params: any[] = []) {
        return pool.query(text, params);
    },

    async transaction(fn: (client: pg.PoolClient) => Promise<any>) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
};

export { pool };
