/**
 * Script de migración MSSQL → PostgreSQL - Fase 2
 * Convierte patrones pool.request().input(...).query(...) → pool.query(sql, [params])
 * 
 * Uso: npx tsx scripts/migrate-mssql-to-pg.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/**
 * Convierte un bloque request().input().query() en pool.query() con params
 * Maneja el patrón completo de mssql
 */
function convertRequestBlock(block: string): string {
  // Extraer todos los .input('name', sql.Type, value) 
  const inputRegex = /\.input\(\s*['"](\w+)['"]\s*,\s*(?:sql\.\w+(?:\([^)]*\))?(?:\.\w+)?)\s*,\s*((?:[^,)]+|\([^)]*\))+)\s*\)/g;
  const inputs: { name: string; value: string }[] = [];
  let match;
  
  while ((match = inputRegex.exec(block)) !== null) {
    inputs.push({ name: match[1], value: match[2].trim() });
  }
  
  // Extraer el SQL de .query(`...`) o .query('...')
  const queryMatch = block.match(/\.query\(\s*(`[\s\S]*?`|'[\s\S]*?'|"[\s\S]*?")\s*\)/);
  if (!queryMatch) return block; // Can't convert, return as-is
  
  let sqlStr = queryMatch[1];
  
  // Replace named params @Name with $N
  let paramIndex = 1;
  const paramValues: string[] = [];
  
  for (const input of inputs) {
    const paramPattern = new RegExp(`@${input.name}\\b`, 'g');
    if (paramPattern.test(sqlStr)) {
      sqlStr = sqlStr.replace(paramPattern, `$${paramIndex}`);
      paramValues.push(input.value);
      paramIndex++;
    }
  }
  
  // Handle SELECT TOP N → LIMIT N
  sqlStr = sqlStr.replace(/SELECT\s+TOP\s+(\d+)\s/gi, 'SELECT ');
  const topMatch = block.match(/SELECT\s+TOP\s+(\d+)\s/i) || sqlStr.match(/SELECT\s+TOP\s+\(?\$\d+\)?\s/i);
  
  // Check if we need to add LIMIT
  const topNumMatch = block.match(/SELECT\s+TOP\s+(\d+)\s/i);
  if (topNumMatch) {
    // Add LIMIT at the end of the query (before closing backtick/quote)
    const limitStr = ` LIMIT ${topNumMatch[1]}`;
    if (sqlStr.endsWith('`')) {
      sqlStr = sqlStr.slice(0, -1) + limitStr + '`';
    } else {
      // For template literals, find the end
      sqlStr = sqlStr.replace(/(\s*`)\s*$/, limitStr + '$1');
    }
  }
  
  // Check for TOP with parameter reference
  const topParamMatch = sqlStr.match(/SELECT\s+TOP\s+\(?\$(\d+)\)?\s/i);
  if (topParamMatch) {
    const paramNum = topParamMatch[1];
    sqlStr = sqlStr.replace(/SELECT\s+TOP\s+\(?\$\d+\)?\s/i, 'SELECT ');
    // Add LIMIT $N at end
    if (sqlStr.endsWith('`')) {
      sqlStr = sqlStr.slice(0, -1) + ` LIMIT $${paramNum}` + '`';
    }
  }
  
  // Build the pool.query() call
  if (paramValues.length > 0) {
    return `.query(\n\t\t\t${sqlStr},\n\t\t\t[${paramValues.join(', ')}]\n\t\t)`;
  } else {
    return `.query(${sqlStr})`;
  }
}

function migrateFile(filePath: string): boolean {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  
  // Skip files without .request() pattern
  if (!content.includes('.request()')) return false;
  
  // Strategy: Find complete blocks from pool/connection.request() through .query() 
  // and convert them
  
  // Match: (variable = await )?(pool|connection|request_var)\n  //   .request()\n
  //   .input(name, type, value)\n  (repeated)
  //   .query(`SQL`);
  
  // Use a regex to find request blocks
  const blockRegex = /(?:await\s+)?(?:\w+)\s*\n?\s*\.request\(\)\s*\n?((?:\s*\.input\([^)]+\)\s*\n?)*)\s*\.query\(\s*(`[\s\S]*?`|'[^']*'|"[^"]*")\s*\)/g;
  
  content = content.replace(blockRegex, (fullMatch, inputsStr, sqlStr) => {
    // Parse inputs
    const inputRegex = /\.input\(\s*['"](\w+)['"]\s*,\s*(?:sql\.\w+(?:\([^)]*\))?(?:\.\w+)?)\s*,\s*((?:[^,)]+|\([^)]*\))+)\s*\)/g;
    const inputs: { name: string; value: string }[] = [];
    let m;
    while ((m = inputRegex.exec(inputsStr)) !== null) {
      inputs.push({ name: m[1], value: m[2].trim() });
    }
    
    // Replace @param with $N and collect values
    let paramIndex = 1;
    const paramValues: string[] = [];
    let modifiedSql = sqlStr;
    
    for (const input of inputs) {
      const re = new RegExp(`@${input.name}\\b`, 'g');
      if (re.test(modifiedSql)) {
        modifiedSql = modifiedSql.replace(re, `$${paramIndex}`);
        paramValues.push(input.value);
        paramIndex++;
      }
    }
    
    // Handle TOP N
    const topNumMatch = modifiedSql.match(/SELECT\s+TOP\s+(\d+)\b/i);
    if (topNumMatch) {
      modifiedSql = modifiedSql.replace(/SELECT\s+TOP\s+\d+\b/i, 'SELECT');
      // Insert LIMIT before the closing backtick/quote
      const lastQuoteIdx = modifiedSql.lastIndexOf('`') !== -1 ? modifiedSql.lastIndexOf('`') : 
                           modifiedSql.lastIndexOf("'") !== -1 ? modifiedSql.lastIndexOf("'") : 
                           modifiedSql.lastIndexOf('"');
      if (lastQuoteIdx > 0) {
        modifiedSql = modifiedSql.slice(0, lastQuoteIdx) + `\n\t\t\t\tLIMIT ${topNumMatch[1]}` + modifiedSql.slice(lastQuoteIdx);
      }
    }
    
    // Handle TOP $N (param)
    const topParamMatch = modifiedSql.match(/SELECT\s+TOP\s+\(?\$(\d+)\)?/i);
    if (topParamMatch) {
      modifiedSql = modifiedSql.replace(/SELECT\s+TOP\s+\(?\$\d+\)?/i, 'SELECT');
      const lastQuoteIdx = modifiedSql.lastIndexOf('`') !== -1 ? modifiedSql.lastIndexOf('`') : 
                           modifiedSql.lastIndexOf("'") !== -1 ? modifiedSql.lastIndexOf("'") : 
                           modifiedSql.lastIndexOf('"');
      if (lastQuoteIdx > 0) {
        modifiedSql = modifiedSql.slice(0, lastQuoteIdx) + `\n\t\t\t\tLIMIT $${topParamMatch[1]}` + modifiedSql.slice(lastQuoteIdx);
      }
    }
    
    // Build replacement
    if (paramValues.length > 0) {
      return `.query(\n\t\t\t${modifiedSql},\n\t\t\t[${paramValues.join(', ')}]\n\t\t)`;
    } else {
      return `.query(${modifiedSql})`;
    }
  });
  
  // Handle simple .request().query() without inputs
  content = content.replace(/(?:await\s+)?(\w+)\s*\.request\(\)\s*\.query\(/g, '$1.query(');
  
  // Handle remaining pool\n.request()\n patterns (multiline)
  content = content.replace(/(\w+)\s*\n\s*\.request\(\)\s*\n/g, '$1\n');
  
  // Handle `const request = pool.request()` → remove and update
  content = content.replace(/const\s+(\w+)\s*=\s*(?:pool|connection)\.request\(\);?\s*\n/g, '');
  content = content.replace(/const\s+(\w+)\s*=\s*new\s+sql\.Request\([^)]*\);?\s*\n/g, '');
  
  // Handle sql.Transaction patterns
  content = content.replace(/const\s+(\w+)\s*=\s*new\s+sql\.Transaction\([^)]*\);?\s*\n/g, '');
  content = content.replace(/await\s+(\w+)\.begin\(\);?\s*\n/g, '');
  content = content.replace(/await\s+(\w+)\.commit\(\);?\s*\n/g, '');
  content = content.replace(/await\s+(\w+)\.rollback\(\);?\s*\n/g, '');
  
  // Remove remaining `sql.` type references that might be left
  content = content.replace(/,\s*sql\.\w+(?:\([^)]*\))?(?:\.\w+)?/g, '');
  
  // Clean up any remaining .request() → remove
  content = content.replace(/\.request\(\)\s*\n\s*\./g, '.');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  return false;
}

const allFiles = [...findTsFiles(SRC_DIR), ...findTsFiles(WORKER_DIR)];
let changed = 0;

for (const file of allFiles) {
  if (migrateFile(file)) {
    const rel = path.relative(path.join(__dirname, '..'), file);
    console.log(`✅ ${rel}`);
    changed++;
  }
}

console.log(`\n${changed} archivos modificados de ${allFiles.length} total`);
