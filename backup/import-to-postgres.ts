/**
 * Importa datos JSON exportados de MSSQL a PostgreSQL
 * 
 * Uso:
 *   1. Crear BD en PostgreSQL: createdb cobranza
 *   2. Ejecutar esquema: psql cobranza < backup/schema-postgres.sql
 *   3. Importar datos: npx tsx backup/import-to-postgres.ts
 *
 * Requiere: PG_CONNECTION_STRING en .env (ej: postgresql://user:pass@localhost:5432/cobranza)
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const DATA_DIR = path.join(__dirname, 'data');

// Tablas con columnas IDENTITY (auto-generadas) que necesitan override
const IDENTITY_COLS: Record<string, string[]> = {
  "Agentes_Clientes": [
    "Id"
  ],
  "audit_log": [
    "id"
  ],
  "auditoria_intentos_registro": [
    "Id"
  ],
  "Clientes": [
    "Id"
  ],
  "ComprobantesRecibidos": [
    "Id"
  ],
  "ConceptosFactura": [
    "Id"
  ],
  "configuracion_organizacion": [
    "id"
  ],
  "ConfiguracionCobranza": [
    "Id"
  ],
  "DatosFacturacionSuscripcion": [
    "Id"
  ],
  "Estados": [
    "ID"
  ],
  "estados_factura": [
    "id"
  ],
  "FacturaEnvios": [
    "Id"
  ],
  "Facturas": [
    "Id"
  ],
  "GestionesCobranza": [
    "Id"
  ],
  "ImpuestosConcepto": [
    "Id"
  ],
  "Organizaciones": [
    "Id"
  ],
  "Organizaciones_BaileysSession": [
    "Id"
  ],
  "Pagos": [
    "Id"
  ],
  "PagosSuscripcion": [
    "Id"
  ],
  "Paises": [
    "ID"
  ],
  "prioridades_cobranza": [
    "id"
  ],
  "Recordatorios": [
    "Id"
  ],
  "RecordatoriosProgramados": [
    "Id"
  ],
  "Regimen": [
    "ID_Regimen"
  ],
  "Roles": [
    "Id"
  ],
  "Suscripciones": [
    "Id"
  ],
  "Usuario_Organizacion": [
    "Id"
  ],
  "Usuarios": [
    "Id"
  ]
};

// Orden de inserción respetando FKs (tablas padre primero)
// IMPORTANTE: Ajustar este orden según las dependencias de tu esquema
const TABLE_ORDER: string[] = [
  "Agentes_Clientes",
  "audit_log",
  "auditoria_intentos_registro",
  "Clientes",
  "ComprobantesRecibidos",
  "ConceptosFactura",
  "configuracion_organizacion",
  "ConfiguracionCobranza",
  "DatosFacturacionSuscripcion",
  "Estados",
  "estados_factura",
  "FacturaEnvios",
  "Facturas",
  "GestionesCobranza",
  "ImpuestosConcepto",
  "Organizaciones",
  "Organizaciones_BaileysSession",
  "Pagos",
  "PagosSuscripcion",
  "Paises",
  "prioridades_cobranza",
  "Recordatorios",
  "RecordatoriosProgramados",
  "Regimen",
  "Roles",
  "Suscripciones",
  "Usuario_Organizacion",
  "Usuarios"
];

async function main() {
  const connString = process.env.PG_CONNECTION_STRING;
  if (!connString) {
    console.error('Error: PG_CONNECTION_STRING no definida en .env');
    console.error('Ejemplo: PG_CONNECTION_STRING=postgresql://user:pass@localhost:5432/cobranza');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: connString });
  await client.connect();
  console.log('Conectado a PostgreSQL');

  // Deshabilitar triggers temporalmente para evitar problemas con FKs
  await client.query('SET session_replication_role = replica;');

  let totalInserted = 0;

  for (const tableName of TABLE_ORDER) {
    const filePath = path.join(DATA_DIR, `${tableName}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`  ${tableName}: sin datos (skip)`);
      continue;
    }

    const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (rows.length === 0) continue;

    console.log(`  ${tableName}: ${rows.length} filas...`);

    const hasIdentity = IDENTITY_COLS[tableName]?.length > 0;

    // Si tiene IDENTITY, necesitamos OVERRIDING SYSTEM VALUE
    for (const row of rows) {
      const columns = Object.keys(row);
      const values = Object.values(row).map(convertValue);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const colNames = columns.map(c => `"${c}"`).join(', ');

      const insertSQL = hasIdentity
        ? `INSERT INTO "${tableName}" (${colNames}) OVERRIDING SYSTEM VALUE VALUES (${placeholders})`
        : `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`;

      try {
        await client.query(insertSQL, values);
        totalInserted++;
      } catch (err: any) {
        console.error(`    Error en ${tableName}: ${err.message}`);
        console.error(`    Row: ${JSON.stringify(row).substring(0, 200)}`);
      }
    }

    // Resetear secuencia de IDENTITY al máximo valor insertado
    if (hasIdentity) {
      for (const idCol of IDENTITY_COLS[tableName]) {
        try {
          await client.query(`
            SELECT setval(
              pg_get_serial_sequence('"${tableName}"', '${idCol}'),
              COALESCE((SELECT MAX("${idCol}") FROM "${tableName}"), 1)
            )
          `);
        } catch (err: any) {
          console.error(`    Error reseteando secuencia ${tableName}.${idCol}: ${err.message}`);
        }
      }
    }
  }

  // Re-habilitar triggers
  await client.query('SET session_replication_role = DEFAULT;');

  console.log(`\nTotal: ${totalInserted} filas insertadas`);
  await client.end();
  console.log('✅ Importación completa');
}

function convertValue(val: any): any {
  if (val === null || val === undefined) return null;
  // BIT de MSSQL viene como true/false ya desde JSON
  if (typeof val === 'boolean') return val;
  // Dates vienen como strings ISO
  return val;
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
