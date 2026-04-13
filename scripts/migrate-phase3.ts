/**
 * Script de migración MSSQL → PostgreSQL - Fase 3
 * Limpia patrones SQL restantes que no fueron convertidos en fase 2
 * 
 * Convierte:
 *  - DATEDIFF(day, a, b) → (b::date - a::date)  o  (a::date - b::date)
 *  - DATEADD(unit, n, date) → date + INTERVAL 'n units'
 *  - SCOPE_IDENTITY() → currval() [necesita RETURNING en su lugar]
 *  - GETDATE() → NOW()
 *  - '%' + expr → '%' || expr (string concatenation)
 *  - SELECT TOP N → SELECT ... LIMIT N (partial)
 *  - OFFSET @x ROWS FETCH NEXT @y ROWS ONLY → LIMIT $y OFFSET $x
 * 
 * Uso: npx tsx scripts/migrate-phase3.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY_RUN = process.argv.includes('--dry-run');
const SRC_DIR = path.join(__dirname, '..', 'src');
const WORKER_DIR = path.join(__dirname, '..', 'worker');

function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function migrateFile(filePath: string): { changed: boolean; fixes: string[] } {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  const fixes: string[] = [];
  
  // 1. GETDATE() → NOW() (some may have been missed)
  if (content.includes('GETDATE()')) {
    content = content.replace(/GETDATE\(\)/g, 'NOW()');
    fixes.push('GETDATE() → NOW()');
  }
  
  // 2. DATEDIFF(day, a, b) → (b::date - a::date) or EXTRACT(EPOCH FROM ...)
  // Common patterns:
  // DATEDIFF(day, FechaVencimiento, NOW()) → (NOW()::date - "FechaVencimiento"::date)
  // DATEDIFF(DAY, f.FechaVencimiento, NOW()) → (NOW()::date - f."FechaVencimiento"::date)
  // DATEDIFF(DAY, NOW(), f.FechaVencimiento) → (f."FechaVencimiento"::date - NOW()::date)
  const datediffRegex = /DATEDIFF\s*\(\s*(?:day|DAY)\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g;
  if (datediffRegex.test(content)) {
    content = content.replace(/DATEDIFF\s*\(\s*(?:day|DAY)\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g, 
      '($2::date - $1::date)');
    fixes.push('DATEDIFF → date subtraction');
  }
  
  // 3. DATEADD patterns
  // DATEADD(DAY, -7, NOW()) → NOW() - INTERVAL '7 days'
  // DATEADD(MONTH, -3, @Hoy) → $1 - INTERVAL '3 months'
  // DATEADD(QUARTER, -4, @Hoy) → $1 - INTERVAL '12 months' (quarter*3)
  // DATEADD(WEEK, -4, @Hoy) → $1 - INTERVAL '4 weeks'
  // DATEADD(DAY, 7, NOW()) → NOW() + INTERVAL '7 days'
  const dateaddRegex = /DATEADD\s*\(\s*(\w+)\s*,\s*(-?\d+)\s*,\s*([^)]+?)\s*\)/g;
  if (dateaddRegex.test(content)) {
    content = content.replace(/DATEADD\s*\(\s*(\w+)\s*,\s*(-?\d+)\s*,\s*([^)]+?)\s*\)/g, 
      (match, unit, num, dateExpr) => {
        const n = parseInt(num);
        let pgUnit = unit.toLowerCase();
        let absN = Math.abs(n);
        
        // Convert QUARTER to months
        if (pgUnit === 'quarter') {
          pgUnit = 'months';
          absN = absN * 3;
        } else if (pgUnit === 'day') {
          pgUnit = 'days';
        } else if (pgUnit === 'month') {
          pgUnit = 'months';
        } else if (pgUnit === 'week') {
          pgUnit = 'weeks';
        } else if (pgUnit === 'hour') {
          pgUnit = 'hours';
        }
        
        const op = n < 0 ? '-' : '+';
        return `${dateExpr} ${op} INTERVAL '${absN} ${pgUnit}'`;
      });
    fixes.push('DATEADD → INTERVAL');
  }
  
  // 4. String concatenation in SQL: '%' + expr → '%' || expr 
  // Only inside template literals (backtick strings) to avoid JS string changes
  // Match: '%' + or "%" + patterns specifically
  // This is hard to isolate, so we only target the specific known pattern:
  // LIKE '%' + RIGHT(...) → LIKE '%' || RIGHT(...)
  if (content.includes("'%' + ") || content.includes("+ '%'")) {
    content = content.replace(/'%'\s*\+\s*RIGHT/g, "'%' || RIGHT");
    content = content.replace(/\+\s*'%'/g, "|| '%'");
    if (content !== original && !fixes.includes("SQL string concat '+' → '||'")) {
      fixes.push("SQL string concat '+' → '||'");
    }
  }
  
  // 5. SCOPE_IDENTITY() → this needs RETURNING clause
  // Replace: SELECT SCOPE_IDENTITY() as id; → remove and rely on RETURNING
  // But this is tricky - the INSERT above should already have RETURNING
  // For now, remove the SELECT SCOPE_IDENTITY() line as the INSERT should use RETURNING
  if (content.includes('SCOPE_IDENTITY()')) {
    // Pattern: INSERT ... ; SELECT SCOPE_IDENTITY() as id;
    // → INSERT ... RETURNING "Id" as id;
    // Actually, let's just remove the SCOPE_IDENTITY line and add RETURNING to INSERT if missing
    content = content.replace(/;\s*\n\s*SELECT\s+SCOPE_IDENTITY\(\)\s+as\s+(\w+)\s*;?/gi, 
      '\n\t\t\t\tRETURNING "Id" as $1');
    fixes.push('SCOPE_IDENTITY() → RETURNING');
  }
  
  // 6. SELECT TOP N (remaining ones not caught by phase 2)
  // Can't auto-convert these reliably since LIMIT needs to be at the end
  // Just flag them for now
  
  // 7. OFFSET @x ROWS FETCH NEXT @y ROWS ONLY → LIMIT $y OFFSET $x
  // Only match if we find this specific SQL pagination pattern
  const offsetFetchRegex = /OFFSET\s+(\$\d+|@\w+)\s+ROWS\s*\n?\s*FETCH\s+NEXT\s+(\$\d+|@\w+)\s+ROWS\s+ONLY/gi;
  if (offsetFetchRegex.test(content)) {
    content = content.replace(
      /OFFSET\s+(\$\d+|@\w+)\s+ROWS\s*\n?\s*FETCH\s+NEXT\s+(\$\d+|@\w+)\s+ROWS\s+ONLY/gi,
      'LIMIT $2 OFFSET $1'
    );
    fixes.push('OFFSET/FETCH → LIMIT/OFFSET');
  }
  
  if (content !== original) {
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }
    return { changed: true, fixes };
  }
  return { changed: false, fixes: [] };
}

const allFiles = [...findTsFiles(SRC_DIR), ...findTsFiles(WORKER_DIR)];
let changedFiles = 0;

console.log(DRY_RUN ? '🔍 DRY RUN\n' : '🔄 Phase 3: SQL syntax cleanup...\n');

for (const file of allFiles) {
  const { changed, fixes } = migrateFile(file);
  if (changed) {
    const rel = path.relative(path.join(__dirname, '..'), file);
    console.log(`✅ ${rel}: ${fixes.join(', ')}`);
    changedFiles++;
  }
}

console.log(`\n${changedFiles} files modified (${allFiles.length} scanned)`);
if (DRY_RUN) console.log('\n⚠️ DRY RUN - run without --dry-run to apply.');
