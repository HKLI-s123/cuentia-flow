// src/lib/server/getRegimenes.ts
import { getConnection } from './db';

export interface Regimen {
    id: number;
    clave: string;
    descripcion: string;
}

export async function getRegimenes(): Promise<Regimen[]> {
    const pool = await getConnection();
    const result = await pool.query('SELECT ID_Regimen, Codigo, Descripcion FROM Regimen');
    return result.rows;
}