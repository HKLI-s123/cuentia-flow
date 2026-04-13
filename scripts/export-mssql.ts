/**
 * Script para exportar esquema completo + datos de Azure SQL Server
 * Genera:
 *   1. backup/schema-mssql.sql   — DDL de todas las tablas, índices, FKs, constraints
 *   2. backup/data/              — Un JSON por tabla con todos los registros
 *
 * Uso: npx tsx scripts/export-mssql.ts
 * Requiere: variables de entorno DB_USER, DB_PASSWORD, DB_SERVER, DB_NAME
 */
import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: sql.config = {
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  server: process.env.DB_SERVER!,
  database: process.env.DB_NAME!,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  requestTimeout: 120000, // 2 min para tablas grandes
};

const BACKUP_DIR = path.join(__dirname, '..', 'backup');
const DATA_DIR = path.join(BACKUP_DIR, 'data');

async function main() {
  console.log('Conectando a Azure SQL...');
  const pool = await sql.connect(config);
  console.log('Conectado.\n');

  fs.mkdirSync(DATA_DIR, { recursive: true });

  // ========================================
  // 1. EXPORTAR ESQUEMA
  // ========================================
  console.log('=== EXPORTANDO ESQUEMA ===\n');

  // 1a. Obtener todas las tablas
  const tablesResult = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo'
    ORDER BY TABLE_NAME
  `);
  const tables = tablesResult.recordset.map((r: any) => r.TABLE_NAME);
  console.log(`Tablas encontradas: ${tables.length}`);
  tables.forEach((t: string) => console.log(`  - ${t}`));

  let schemaDDL = `-- ============================================\n`;
  schemaDDL += `-- Azure SQL Server Schema Export\n`;
  schemaDDL += `-- Database: ${process.env.DB_NAME}\n`;
  schemaDDL += `-- Exported: ${new Date().toISOString()}\n`;
  schemaDDL += `-- ============================================\n\n`;

  // 1b. Para cada tabla, obtener columnas
  for (const tableName of tables) {
    console.log(`\nProcesando tabla: ${tableName}`);

    const columnsResult = await pool.request()
      .input('tableName', sql.NVarChar, tableName)
      .query(`
        SELECT 
          c.COLUMN_NAME,
          c.DATA_TYPE,
          c.CHARACTER_MAXIMUM_LENGTH,
          c.NUMERIC_PRECISION,
          c.NUMERIC_SCALE,
          c.IS_NULLABLE,
          c.COLUMN_DEFAULT,
          COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY
        FROM INFORMATION_SCHEMA.COLUMNS c
        WHERE c.TABLE_NAME = @tableName AND c.TABLE_SCHEMA = 'dbo'
        ORDER BY c.ORDINAL_POSITION
      `);

    schemaDDL += `-- ----------------------------------------\n`;
    schemaDDL += `-- Table: ${tableName}\n`;
    schemaDDL += `-- ----------------------------------------\n`;
    schemaDDL += `CREATE TABLE [${tableName}] (\n`;

    const colDefs: string[] = [];
    for (const col of columnsResult.recordset) {
      let def = `  [${col.COLUMN_NAME}] ${col.DATA_TYPE.toUpperCase()}`;

      // Agregar tamaño/precisión
      if (['nvarchar', 'varchar', 'char', 'nchar'].includes(col.DATA_TYPE)) {
        def += col.CHARACTER_MAXIMUM_LENGTH === -1 ? '(MAX)' : `(${col.CHARACTER_MAXIMUM_LENGTH})`;
      } else if (['decimal', 'numeric'].includes(col.DATA_TYPE)) {
        def += `(${col.NUMERIC_PRECISION}, ${col.NUMERIC_SCALE})`;
      }

      // Identity
      if (col.IS_IDENTITY === 1) {
        def += ' IDENTITY(1,1)';
      }

      // Nullable
      def += col.IS_NULLABLE === 'NO' ? ' NOT NULL' : ' NULL';

      // Default
      if (col.COLUMN_DEFAULT) {
        def += ` DEFAULT ${col.COLUMN_DEFAULT}`;
      }

      colDefs.push(def);
    }

    schemaDDL += colDefs.join(',\n');
    schemaDDL += '\n);\n\n';

    // Primary Keys
    const pkResult = await pool.request()
      .input('tableName', sql.NVarChar, tableName)
      .query(`
        SELECT kcu.COLUMN_NAME, tc.CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
          ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        WHERE tc.TABLE_NAME = @tableName 
          AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND tc.TABLE_SCHEMA = 'dbo'
        ORDER BY kcu.ORDINAL_POSITION
      `);

    if (pkResult.recordset.length > 0) {
      const pkCols = pkResult.recordset.map((r: any) => `[${r.COLUMN_NAME}]`).join(', ');
      const pkName = pkResult.recordset[0].CONSTRAINT_NAME;
      schemaDDL += `ALTER TABLE [${tableName}] ADD CONSTRAINT [${pkName}] PRIMARY KEY (${pkCols});\n`;
    }

    // Unique Constraints
    const ucResult = await pool.request()
      .input('tableName', sql.NVarChar, tableName)
      .query(`
        SELECT tc.CONSTRAINT_NAME, kcu.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
          ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        WHERE tc.TABLE_NAME = @tableName 
          AND tc.CONSTRAINT_TYPE = 'UNIQUE'
          AND tc.TABLE_SCHEMA = 'dbo'
        ORDER BY tc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
      `);

    if (ucResult.recordset.length > 0) {
      const grouped: Record<string, string[]> = {};
      for (const uc of ucResult.recordset) {
        if (!grouped[uc.CONSTRAINT_NAME]) grouped[uc.CONSTRAINT_NAME] = [];
        grouped[uc.CONSTRAINT_NAME].push(`[${uc.COLUMN_NAME}]`);
      }
      for (const [name, cols] of Object.entries(grouped)) {
        schemaDDL += `ALTER TABLE [${tableName}] ADD CONSTRAINT [${name}] UNIQUE (${cols.join(', ')});\n`;
      }
    }

    schemaDDL += '\n';
  }

  // Foreign Keys (todas las tablas)
  console.log('\nExportando Foreign Keys...');
  const fkResult = await pool.request().query(`
    SELECT 
      fk.name AS FK_NAME,
      tp.name AS PARENT_TABLE,
      cp.name AS PARENT_COLUMN,
      tr.name AS REFERENCED_TABLE,
      cr.name AS REFERENCED_COLUMN,
      fk.delete_referential_action_desc AS ON_DELETE,
      fk.update_referential_action_desc AS ON_UPDATE
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
    JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
    JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
    JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
    ORDER BY tp.name, fk.name
  `);

  if (fkResult.recordset.length > 0) {
    schemaDDL += `-- ----------------------------------------\n`;
    schemaDDL += `-- Foreign Keys\n`;
    schemaDDL += `-- ----------------------------------------\n`;
    for (const fk of fkResult.recordset) {
      let fkDef = `ALTER TABLE [${fk.PARENT_TABLE}] ADD CONSTRAINT [${fk.FK_NAME}] `;
      fkDef += `FOREIGN KEY ([${fk.PARENT_COLUMN}]) REFERENCES [${fk.REFERENCED_TABLE}]([${fk.REFERENCED_COLUMN}])`;
      if (fk.ON_DELETE !== 'NO_ACTION') fkDef += ` ON DELETE ${fk.ON_DELETE.replace('_', ' ')}`;
      if (fk.ON_UPDATE !== 'NO_ACTION') fkDef += ` ON UPDATE ${fk.ON_UPDATE.replace('_', ' ')}`;
      fkDef += ';\n';
      schemaDDL += fkDef;
    }
    schemaDDL += '\n';
  }

  // Indexes (non-PK, non-unique-constraint)
  console.log('Exportando Indexes...');
  const idxResult = await pool.request().query(`
    SELECT 
      i.name AS INDEX_NAME,
      t.name AS TABLE_NAME,
      c.name AS COLUMN_NAME,
      i.is_unique,
      i.filter_definition
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    JOIN sys.tables t ON i.object_id = t.object_id
    WHERE i.is_primary_key = 0
      AND i.type > 0
      AND i.name NOT LIKE 'UQ_%'
      AND NOT EXISTS (
        SELECT 1 FROM sys.key_constraints kc 
        WHERE kc.unique_index_id = i.index_id AND kc.parent_object_id = i.object_id
      )
    ORDER BY t.name, i.name, ic.key_ordinal
  `);

  if (idxResult.recordset.length > 0) {
    schemaDDL += `-- ----------------------------------------\n`;
    schemaDDL += `-- Indexes\n`;
    schemaDDL += `-- ----------------------------------------\n`;

    const idxGrouped: Record<string, { table: string; cols: string[]; unique: boolean; filter: string | null }> = {};
    for (const idx of idxResult.recordset) {
      const key = `${idx.TABLE_NAME}.${idx.INDEX_NAME}`;
      if (!idxGrouped[key]) {
        idxGrouped[key] = { table: idx.TABLE_NAME, cols: [], unique: idx.is_unique, filter: idx.filter_definition };
      }
      idxGrouped[key].cols.push(idx.COLUMN_NAME);
    }

    for (const [, idx] of Object.entries(idxGrouped)) {
      let idxDef = `CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX ON [${idx.table}] (${idx.cols.map(c => `[${c}]`).join(', ')})`;
      if (idx.filter) idxDef += ` WHERE ${idx.filter}`;
      idxDef += ';\n';
      schemaDDL += idxDef;
    }
    schemaDDL += '\n';
  }

  // Guardar esquema
  const schemaPath = path.join(BACKUP_DIR, 'schema-mssql.sql');
  fs.writeFileSync(schemaPath, schemaDDL);
  console.log(`\nEsquema guardado en: ${schemaPath}`);

  // ========================================
  // 2. EXPORTAR DATOS
  // ========================================
  console.log('\n=== EXPORTANDO DATOS ===\n');

  let totalRows = 0;
  for (const tableName of tables) {
    const countResult = await pool.request().query(`SELECT COUNT(*) as cnt FROM [${tableName}]`);
    const count = countResult.recordset[0].cnt;

    if (count === 0) {
      console.log(`  ${tableName}: 0 filas (skip)`);
      continue;
    }

    console.log(`  ${tableName}: ${count} filas...`);

    const dataResult = await pool.request().query(`SELECT * FROM [${tableName}]`);
    const rows = dataResult.recordset;

    const dataPath = path.join(DATA_DIR, `${tableName}.json`);
    fs.writeFileSync(dataPath, JSON.stringify(rows, null, 2));
    totalRows += count;
  }

  console.log(`\nTotal: ${totalRows} filas exportadas en ${tables.length} tablas`);
  console.log(`Datos guardados en: ${DATA_DIR}/`);

  await pool.close();
  console.log('\n✅ Exportación completa');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
