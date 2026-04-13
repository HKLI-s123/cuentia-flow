/**
 * Script para convertir el esquema exportado de MSSQL a PostgreSQL
 * y luego importar los datos JSON exportados.
 *
 * Uso:
 *   1. Primero: npx tsx scripts/export-mssql.ts          (exporta de Azure SQL)
 *   2. Luego:   npx tsx scripts/convert-to-postgres.ts    (genera schema PG + script de importación)
 *
 * Genera:
 *   backup/schema-postgres.sql  — DDL compatible con PostgreSQL
 *   backup/import-data.sql      — Script para importar datos JSON a PostgreSQL
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '..', 'backup');
const DATA_DIR = path.join(BACKUP_DIR, 'data');

// =========================================
// Mapeo de tipos MSSQL → PostgreSQL
// =========================================
const TYPE_MAP: Record<string, string> = {
  // Strings
  'NVARCHAR(MAX)': 'TEXT',
  'VARCHAR(MAX)': 'TEXT',
  'NTEXT': 'TEXT',
  'TEXT': 'TEXT',
  'NCHAR': 'CHAR',
  // Números
  'INT': 'INTEGER',
  'BIGINT': 'BIGINT',
  'SMALLINT': 'SMALLINT',
  'TINYINT': 'SMALLINT', // PG no tiene TINYINT
  'FLOAT': 'DOUBLE PRECISION',
  'REAL': 'REAL',
  'MONEY': 'NUMERIC(19,4)',
  'SMALLMONEY': 'NUMERIC(10,4)',
  // Fechas
  'DATETIME': 'TIMESTAMP',
  'DATETIME2': 'TIMESTAMP',
  'SMALLDATETIME': 'TIMESTAMP',
  'DATE': 'DATE',
  'TIME': 'TIME',
  'DATETIMEOFFSET': 'TIMESTAMPTZ',
  // Booleanos
  'BIT': 'BOOLEAN',
  // Binarios
  'VARBINARY(MAX)': 'BYTEA',
  'VARBINARY': 'BYTEA',
  'IMAGE': 'BYTEA',
  // UUID
  'UNIQUEIDENTIFIER': 'UUID',
  // XML
  'XML': 'XML',
};

function convertType(mssqlType: string): string {
  // Buscar match exacto primero (ej: NVARCHAR(MAX))
  const upper = mssqlType.toUpperCase().trim();
  if (TYPE_MAP[upper]) return TYPE_MAP[upper];

  // Patrones con tamaño
  const match = upper.match(/^(\w+)\((\d+|MAX)\)$/);
  if (match) {
    const [, baseType, size] = match;

    if (size === 'MAX') {
      return 'TEXT';
    }

    // NVARCHAR(N) / VARCHAR(N) → VARCHAR(N)
    if (['NVARCHAR', 'VARCHAR'].includes(baseType)) {
      return `VARCHAR(${size})`;
    }

    // NCHAR(N) → CHAR(N)
    if (baseType === 'NCHAR') {
      return `CHAR(${size})`;
    }

    // VARBINARY(N) → BYTEA
    if (baseType === 'VARBINARY') {
      return 'BYTEA';
    }

    // Tipo base en el mapa
    if (TYPE_MAP[baseType]) {
      return TYPE_MAP[baseType];
    }

    // Tipos con precisión (DECIMAL, NUMERIC) - pasar tal cual
    if (['DECIMAL', 'NUMERIC'].includes(baseType)) {
      return upper; // DECIMAL(18,2) es válido en PG
    }
  }

  // DECIMAL/NUMERIC con precisión completa
  const precMatch = upper.match(/^(DECIMAL|NUMERIC)\((\d+),\s*(\d+)\)$/);
  if (precMatch) {
    return upper; // compatible directamente
  }

  // Tipos sin modificar que son compatibles
  if (['INTEGER', 'BIGINT', 'SMALLINT', 'BOOLEAN', 'TEXT', 'DATE', 'TIME', 'TIMESTAMP', 'UUID', 'XML', 'BYTEA'].includes(upper)) {
    return upper;
  }

  // Default: intentar usar tal cual con advertencia
  console.warn(`  ⚠ Tipo no mapeado: ${mssqlType} — se usará tal cual`);
  return upper;
}

function convertDefault(defaultVal: string | null, colType: string): string | null {
  if (!defaultVal) return null;

  let d = defaultVal.trim();

  // Quitar paréntesis extras de MSSQL: ((0)) → 0, (getdate()) → getdate()
  while (d.startsWith('(') && d.endsWith(')')) {
    d = d.slice(1, -1);
  }

  // GETDATE() / GETUTCDATE() → NOW() / NOW() AT TIME ZONE 'UTC'
  if (/^getdate\(\)$/i.test(d)) return 'NOW()';
  if (/^getutcdate\(\)$/i.test(d)) return "(NOW() AT TIME ZONE 'UTC')";

  // NEWID() → gen_random_uuid()
  if (/^newid\(\)$/i.test(d)) return 'gen_random_uuid()';

  // Valores booleanos para BIT → BOOLEAN
  if (colType === 'BOOLEAN') {
    if (d === '0') return 'FALSE';
    if (d === '1') return 'TRUE';
  }

  // String literals
  if (/^N?'.*'$/.test(d)) {
    return d.replace(/^N/, ''); // Quitar prefijo N de strings Unicode
  }

  // Numéricos
  if (/^-?\d+(\.\d+)?$/.test(d)) {
    return d;
  }

  return d;
}

function main() {
  const schemaPath = path.join(BACKUP_DIR, 'schema-mssql.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('Error: No se encontró backup/schema-mssql.sql');
    console.error('Ejecuta primero: npx tsx scripts/export-mssql.ts');
    process.exit(1);
  }

  const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

  let pgSQL = `-- ============================================\n`;
  pgSQL += `-- PostgreSQL Schema (convertido desde MSSQL)\n`;
  pgSQL += `-- Generated: ${new Date().toISOString()}\n`;
  pgSQL += `-- ============================================\n\n`;

  // =========================================
  // Parsear CREATE TABLE statements
  // =========================================
  const tableRegex = /CREATE TABLE \[(\w+)\] \(\n([\s\S]*?)\n\);/g;
  let match;

  const tableNames: string[] = [];
  const identityCols: Record<string, string[]> = {};

  while ((match = tableRegex.exec(schemaSQL)) !== null) {
    const tableName = match[1];
    const columnBlock = match[2];
    tableNames.push(tableName);
    identityCols[tableName] = [];

    console.log(`Convirtiendo tabla: ${tableName}`);

    pgSQL += `-- ----------------------------------------\n`;
    pgSQL += `-- Table: ${tableName}\n`;
    pgSQL += `-- ----------------------------------------\n`;

    const colLines = columnBlock.split(',\n').map(l => l.trim());
    const pgCols: string[] = [];

    for (const line of colLines) {
      // Parsear: [ColName] TYPE(...) IDENTITY(1,1) NOT NULL DEFAULT (value)
      const colMatch = line.match(/^\[(\w+)\]\s+(\w+(?:\([^)]*\))?)\s*(.*)/);
      if (!colMatch) {
        console.warn(`  ⚠ No se pudo parsear: ${line}`);
        continue;
      }

      const [, colName, rawType, rest] = colMatch;
      const isIdentity = /IDENTITY\(\d+,\s*\d+\)/i.test(rest);
      const isNullable = !/NOT NULL/i.test(rest);
      const defaultMatch = rest.match(/DEFAULT\s+(.+?)$/i);

      let pgType = convertType(rawType);

      // IDENTITY → GENERATED ALWAYS AS IDENTITY
      if (isIdentity) {
        identityCols[tableName].push(colName);
        pgType = pgType === 'BIGINT' ? 'BIGINT' : 'INTEGER';
        pgCols.push(`  "${colName}" ${pgType} GENERATED ALWAYS AS IDENTITY${isNullable ? '' : ' NOT NULL'}`);
        continue;
      }

      let colDef = `  "${colName}" ${pgType}`;
      if (!isNullable) colDef += ' NOT NULL';

      if (defaultMatch) {
        const pgDefault = convertDefault(defaultMatch[1], pgType);
        if (pgDefault) colDef += ` DEFAULT ${pgDefault}`;
      }

      pgCols.push(colDef);
    }

    pgSQL += `CREATE TABLE "${tableName}" (\n`;
    pgSQL += pgCols.join(',\n');
    pgSQL += `\n);\n\n`;
  }

  // =========================================
  // Parsear ALTER TABLE ... PRIMARY KEY
  // =========================================
  const pkRegex = /ALTER TABLE \[(\w+)\] ADD CONSTRAINT \[(\w+)\] PRIMARY KEY \(([^)]+)\);/g;
  while ((match = pkRegex.exec(schemaSQL)) !== null) {
    const [, tableName, constraintName, rawCols] = match;
    const cols = rawCols.replace(/\[|\]/g, '').split(',').map(c => `"${c.trim()}"`).join(', ');
    pgSQL += `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" PRIMARY KEY (${cols});\n`;
  }

  // =========================================
  // Parsear ALTER TABLE ... UNIQUE
  // =========================================
  const ucRegex = /ALTER TABLE \[(\w+)\] ADD CONSTRAINT \[(\w+)\] UNIQUE \(([^)]+)\);/g;
  while ((match = ucRegex.exec(schemaSQL)) !== null) {
    const [, tableName, constraintName, rawCols] = match;
    const cols = rawCols.replace(/\[|\]/g, '').split(',').map(c => `"${c.trim()}"`).join(', ');
    pgSQL += `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" UNIQUE (${cols});\n`;
  }

  pgSQL += '\n';

  // =========================================
  // Parsear Foreign Keys
  // =========================================
  const fkRegex = /ALTER TABLE \[(\w+)\] ADD CONSTRAINT \[(\w+)\] FOREIGN KEY \(\[(\w+)\]\) REFERENCES \[(\w+)\]\(\[(\w+)\]\)(.*?);/g;
  while ((match = fkRegex.exec(schemaSQL)) !== null) {
    const [, parentTable, fkName, parentCol, refTable, refCol, actions] = match;
    let fkDef = `ALTER TABLE "${parentTable}" ADD CONSTRAINT "${fkName}" `;
    fkDef += `FOREIGN KEY ("${parentCol}") REFERENCES "${refTable}"("${refCol}")`;
    if (actions.trim()) {
      fkDef += ' ' + actions.trim()
        .replace(/CASCADE/g, 'CASCADE')
        .replace(/SET NULL/g, 'SET NULL')
        .replace(/SET DEFAULT/g, 'SET DEFAULT');
    }
    fkDef += ';\n';
    pgSQL += fkDef;
  }

  pgSQL += '\n';

  // =========================================
  // Parsear Indexes
  // =========================================
  const idxRegex = /CREATE (UNIQUE )?INDEX ON \[(\w+)\] \(([^)]+)\)(?:\s+WHERE\s+(.+))?;/g;
  let idxCounter = 0;
  while ((match = idxRegex.exec(schemaSQL)) !== null) {
    const [, unique, tableName, rawCols, filter] = match;
    const cols = rawCols.replace(/\[|\]/g, '').split(',').map(c => `"${c.trim()}"`).join(', ');
    const idxName = `idx_${tableName.toLowerCase()}_${idxCounter++}`;
    let idxDef = `CREATE ${unique || ''}INDEX "${idxName}" ON "${tableName}" (${cols})`;
    if (filter) {
      // Convertir filtro MSSQL a PG
      let pgFilter = filter
        .replace(/\[(\w+)\]/g, '"$1"')
        .replace(/IS NOT NULL/gi, 'IS NOT NULL')
        .replace(/IS NULL/gi, 'IS NULL');
      idxDef += ` WHERE ${pgFilter}`;
    }
    idxDef += ';\n';
    pgSQL += idxDef;
  }

  // Guardar esquema PG
  const pgPath = path.join(BACKUP_DIR, 'schema-postgres.sql');
  fs.writeFileSync(pgPath, pgSQL);
  console.log(`\n✅ Esquema PostgreSQL guardado en: ${pgPath}`);

  // =========================================
  // Generar script de importación de datos
  // =========================================
  if (fs.existsSync(DATA_DIR)) {
    let importSQL = `-- ============================================\n`;
    importSQL += `-- PostgreSQL Data Import Script\n`;
    importSQL += `-- Importa los datos JSON exportados de MSSQL\n`;
    importSQL += `-- ============================================\n\n`;
    importSQL += `-- NOTA: Este script es informativo.\n`;
    importSQL += `-- Usa el script import-to-postgres.ts para importar datos.\n\n`;

    const dataFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    console.log(`\nTablas con datos: ${dataFiles.length}`);

    for (const file of dataFiles) {
      const tableName = file.replace('.json', '');
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
      importSQL += `-- ${tableName}: ${data.length} filas\n`;
    }

    const importPath = path.join(BACKUP_DIR, 'import-data.sql');
    fs.writeFileSync(importPath, importSQL);
  }

  // =========================================
  // Generar script de importación con pg
  // =========================================
  generateImportScript(tableNames, identityCols);

  console.log('\n🎉 Conversión completa. Archivos generados:');
  console.log(`  backup/schema-postgres.sql  — Ejecutar en PostgreSQL`);
  console.log(`  backup/import-to-postgres.ts — Script para importar datos`);
}

function generateImportScript(tableNames: string[], identityCols: Record<string, string[]>) {
  const script = `/**
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
const IDENTITY_COLS: Record<string, string[]> = ${JSON.stringify(identityCols, null, 2)};

// Orden de inserción respetando FKs (tablas padre primero)
// IMPORTANTE: Ajustar este orden según las dependencias de tu esquema
const TABLE_ORDER: string[] = ${JSON.stringify(tableNames, null, 2)};

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
    const filePath = path.join(DATA_DIR, \`\${tableName}.json\`);
    if (!fs.existsSync(filePath)) {
      console.log(\`  \${tableName}: sin datos (skip)\`);
      continue;
    }

    const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (rows.length === 0) continue;

    console.log(\`  \${tableName}: \${rows.length} filas...\`);

    const hasIdentity = IDENTITY_COLS[tableName]?.length > 0;

    // Si tiene IDENTITY, necesitamos OVERRIDING SYSTEM VALUE
    for (const row of rows) {
      const columns = Object.keys(row);
      const values = Object.values(row).map(convertValue);
      const placeholders = values.map((_, i) => \`$\${i + 1}\`).join(', ');
      const colNames = columns.map(c => \`"\${c}"\`).join(', ');

      const insertSQL = hasIdentity
        ? \`INSERT INTO "\${tableName}" (\${colNames}) OVERRIDING SYSTEM VALUE VALUES (\${placeholders})\`
        : \`INSERT INTO "\${tableName}" (\${colNames}) VALUES (\${placeholders})\`;

      try {
        await client.query(insertSQL, values);
        totalInserted++;
      } catch (err: any) {
        console.error(\`    Error en \${tableName}: \${err.message}\`);
        console.error(\`    Row: \${JSON.stringify(row).substring(0, 200)}\`);
      }
    }

    // Resetear secuencia de IDENTITY al máximo valor insertado
    if (hasIdentity) {
      for (const idCol of IDENTITY_COLS[tableName]) {
        try {
          await client.query(\`
            SELECT setval(
              pg_get_serial_sequence('"\${tableName}"', '\${idCol}'),
              COALESCE((SELECT MAX("\${idCol}") FROM "\${tableName}"), 1)
            )
          \`);
        } catch (err: any) {
          console.error(\`    Error reseteando secuencia \${tableName}.\${idCol}: \${err.message}\`);
        }
      }
    }
  }

  // Re-habilitar triggers
  await client.query('SET session_replication_role = DEFAULT;');

  console.log(\`\\nTotal: \${totalInserted} filas insertadas\`);
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
`;

  const importScriptPath = path.join(BACKUP_DIR, 'import-to-postgres.ts');
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(importScriptPath, script);
}

main();
