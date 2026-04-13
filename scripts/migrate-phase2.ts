/**
 * Script de migración MSSQL → PostgreSQL - Fase 2 
 * Convierte patrones .request().input(...).query(...) → pool.query(sql, [params])
 * 
 * Maneja:
 *  - .input('name', sql.Type, value) (3 args)
 *  - .input('name', value) (2 args)
 *  - SELECT TOP N → LIMIT N
 *  - Nested parentheses in values
 *  - Template literals and single/double quoted SQL
 * 
 * Uso: npx tsx scripts/migrate-phase2.ts [--dry-run]
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

/**
 * Find matching closing paren, handling nesting
 */
function findClosingParen(str: string, startIdx: number): number {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  
  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i];
    const prev = i > 0 ? str[i - 1] : '';
    
    if (ch === "'" && !inDoubleQuote && !inBacktick && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote && !inBacktick && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
    } else if (ch === '`' && !inSingleQuote && !inDoubleQuote && prev !== '\\') {
      inBacktick = !inBacktick;
    } else if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  return -1;
}

interface InputParam {
  name: string;
  value: string;
}

/**
 * Parse a single .input(...) call and extract name and value
 * Handles both .input('name', sql.Type, value) and .input('name', value)
 */
function parseInputCall(argsStr: string): InputParam | null {
  // argsStr is everything inside .input(...)
  // Split by commas, but respect nesting
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inSQ = false, inDQ = false, inBT = false;
  
  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    const prev = i > 0 ? argsStr[i - 1] : '';
    
    if (ch === "'" && !inDQ && !inBT && prev !== '\\') inSQ = !inSQ;
    else if (ch === '"' && !inSQ && !inBT && prev !== '\\') inDQ = !inDQ;
    else if (ch === '`' && !inSQ && !inDQ && prev !== '\\') inBT = !inBT;
    
    if (!inSQ && !inDQ && !inBT) {
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
    }
    
    if (ch === ',' && depth === 0 && !inSQ && !inDQ && !inBT) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  
  if (args.length < 2) return null;
  
  // First arg is always the name (quoted string)
  const nameMatch = args[0].match(/^['"](\w+)['"]$/);
  if (!nameMatch) return null;
  const name = nameMatch[1];
  
  // If 3 args: name, sql.Type, value → value is last
  // If 2 args: name, value → value is last
  const value = args[args.length - 1];
  
  return { name, value };
}

/**
 * Find and convert a complete request chain starting at a given position.
 * Returns the replacement string and the end position in the source.
 */
function findAndConvertChain(content: string, requestStart: number): { replacement: string; endPos: number } | null {
  // Find the variable name before .request()
  // Look backwards from requestStart to find the variable/expression
  // Pattern: varName\n   .request()  or  varName.request()
  
  // Find .query( after the inputs
  const afterRequest = content.indexOf('.request()', requestStart);
  if (afterRequest === -1) return null;
  
  let pos = afterRequest + '.request()'.length;
  
  // Collect inputs
  const inputs: InputParam[] = [];
  
  // Skip whitespace and look for .input() or .query()
  while (pos < content.length) {
    // Skip whitespace/newlines
    const wsMatch = content.slice(pos).match(/^[\s\n\r]*/);
    if (wsMatch) pos += wsMatch[0].length;
    
    if (content.slice(pos).startsWith('.input(')) {
      // Parse .input(...)
      pos += '.input('.length;
      const closeParen = findClosingParen(content, pos - 1);  // -1 because we want the opening paren
      if (closeParen === -1) return null;
      
      const argsStr = content.slice(pos, closeParen);
      const param = parseInputCall(argsStr);
      if (param) {
        inputs.push(param);
      }
      pos = closeParen + 1;
    } else if (content.slice(pos).startsWith('.query(')) {
      // Parse .query(...)
      pos += '.query('.length;
      const closeParen = findClosingParen(content, pos - 1);
      if (closeParen === -1) return null;
      
      let sqlStr = content.slice(pos, closeParen).trim();
      
      // Replace @Param with $N
      let paramIndex = 1;
      const paramValues: string[] = [];
      
      for (const input of inputs) {
        const re = new RegExp(`@${input.name}\\b`, 'g');
        if (re.test(sqlStr)) {
          sqlStr = sqlStr.replace(new RegExp(`@${input.name}\\b`, 'g'), `$${paramIndex}`);
          paramValues.push(input.value);
          paramIndex++;
        }
      }
      
      // Handle SELECT TOP N → SELECT ... LIMIT N
      const topMatch = sqlStr.match(/SELECT\s+TOP\s+(\d+)\b/i);
      if (topMatch) {
        sqlStr = sqlStr.replace(/SELECT\s+TOP\s+\d+\b/i, 'SELECT');
        // Add LIMIT before the closing quote
        sqlStr = addLimitToSql(sqlStr, topMatch[1]);
      }
      
      // Handle TOP with param ref  
      const topParamMatch = sqlStr.match(/SELECT\s+TOP\s+\(?\$(\d+)\)?/i);
      if (topParamMatch) {
        sqlStr = sqlStr.replace(/SELECT\s+TOP\s+\(?\$\d+\)?/i, 'SELECT');
        sqlStr = addLimitToSql(sqlStr, `$${topParamMatch[1]}`);
      }
      
      // Build replacement: .query(sql, [params])
      let replacement: string;
      if (paramValues.length > 0) {
        replacement = `.query(\n\t\t\t${sqlStr},\n\t\t\t[${paramValues.join(', ')}]\n\t\t)`;
      } else {
        replacement = `.query(${sqlStr})`;
      }
      
      return { replacement, endPos: closeParen + 1 };
    } else {
      // Unexpected token - bail out
      return null;
    }
  }
  
  return null;
}

function addLimitToSql(sqlStr: string, limit: string): string {
  // Find the last backtick, single quote, or double quote
  for (let i = sqlStr.length - 1; i >= 0; i--) {
    if (sqlStr[i] === '`' || sqlStr[i] === "'" || sqlStr[i] === '"') {
      // Insert LIMIT before it
      const beforeQuote = sqlStr.slice(0, i).trimEnd();
      return beforeQuote + `\n\t\t\t\tLIMIT ${limit}\n\t\t\t` + sqlStr[i];
    }
  }
  return sqlStr;
}

function migrateFile(filePath: string): { changed: boolean; count: number } {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  
  if (!content.includes('.request()')) return { changed: false, count: 0 };
  
  let conversions = 0;
  
  // Find all .request() occurrences and convert them
  // We process from end to start to preserve positions
  const requestPositions: number[] = [];
  let searchPos = 0;
  while (true) {
    const idx = content.indexOf('.request()', searchPos);
    if (idx === -1) break;
    requestPositions.push(idx);
    searchPos = idx + 1;
  }
  
  // Process from end to start
  for (let i = requestPositions.length - 1; i >= 0; i--) {
    const reqPos = requestPositions[i];
    
    // Find the start of the expression (the variable before .request())
    // Go back to find the variable name  
    let exprStart = reqPos - 1;
    
    // Skip whitespace/newlines before .request()
    while (exprStart >= 0 && /[\s\n\r]/.test(content[exprStart])) {
      exprStart--;
    }
    
    // Now we should be at the end of a variable name - go back through it
    // But also handle dotted chains that end with the variable
    // e.g., "pool" or "await pool"
    // We just need to keep .request() replacement starting from '.'
    
    const result = findAndConvertChain(content, reqPos);
    if (result) {
      // Replace from .request() to end of .query()
      content = content.slice(0, reqPos) + result.replacement + content.slice(result.endPos);
      conversions++;
    }
  }
  
  // Clean up: remove `const request = pool.request();` lines that may remain
  content = content.replace(/^\s*const\s+\w+\s*=\s*(?:pool|connection)\.request\(\);?\s*$/gm, '');
  content = content.replace(/^\s*const\s+\w+\s*=\s*new\s+sql\.Request\([^)]*\);?\s*$/gm, '');
  
  if (content !== original) {
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }
    return { changed: true, count: conversions };
  }
  return { changed: false, count: 0 };
}

// Main
const allFiles = [...findTsFiles(SRC_DIR), ...findTsFiles(WORKER_DIR)];
let changedFiles = 0;
let totalConversions = 0;

console.log(DRY_RUN ? '🔍 DRY RUN - no files will be modified\n' : '🔄 Converting request/input/query blocks...\n');

for (const file of allFiles) {
  const { changed, count } = migrateFile(file);
  if (changed) {
    const rel = path.relative(path.join(__dirname, '..'), file);
    console.log(`✅ ${rel} (${count} conversions)`);
    changedFiles++;
    totalConversions += count;
  }
}

console.log(`\n${changedFiles} files modified, ${totalConversions} request blocks converted (${allFiles.length} files scanned)`);
if (DRY_RUN) console.log('\n⚠️ DRY RUN - no changes were written. Run without --dry-run to apply.');
