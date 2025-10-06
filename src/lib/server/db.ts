import sql from 'mssql';
import 'dotenv/config';

function getEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`La variable de entorno ${name} no está definida`);
    return value;
}

const config: sql.config = {
    user: getEnvVar('DB_USER'),
    password: getEnvVar('DB_PASSWORD'),
    server: getEnvVar('DB_SERVER'), // siempre string
    database: getEnvVar('DB_NAME'),
    options: {
        encrypt: true,              // obligatorio para Azure
        trustServerCertificate: false,
    },
};

let pool: sql.ConnectionPool | null = null;

export async function getConnection(): Promise<sql.ConnectionPool> {
    if (pool) return pool;

    try {
        pool = await sql.connect(config);
        return pool;
    } catch (err) {
        throw err;
    }
}

// Objeto db para usar en las APIs
export const db = {
    async query(query: string, params: any[] = []): Promise<any[]> {
        try {
            const connection = await getConnection();
            const request = connection.request();

            // Agregar parámetros si existen
            params.forEach((param, index) => {
                request.input(`param${index}`, param);
            });

            // Reemplazar ? con @param0, @param1, etc.
            let formattedQuery = query;
            params.forEach((_, index) => {
                formattedQuery = formattedQuery.replace('?', `@param${index}`);
            });

            const result = await request.query(formattedQuery);
            return result.recordset || [];
        } catch (error) {
            throw error;
        }
    }
};
