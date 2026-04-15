/**
 * Script to migrate sessionStorage usage to store-based approach
 * in all dashboard files.
 * 
 * Handles:
 * - sessionStorage.getItem('organizacionActualId') → get(orgIdStore)
 * - JSON.parse(sessionStorage.getItem('userData') || '{}') → { organizacionId: get(orgIdStore) }
 * - sessionStorage.setItem(...) → removed
 * - sessionStorage.clear() → removed
 * - Comments referencing sessionStorage → updated
 * 
 * SKIP files: usuarios, configuracion, organizaciones/nueva (handled manually - need obtenerDatosUsuario)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DASHBOARD = path.join(ROOT, 'src', 'routes', 'dashboard');

// Files that need manual handling (use user.id or user.rolId, not just organizacionId)
const SKIP_FILES = [
  'usuarios',
  'configuracion',
  'organizaciones'
];

let totalReplacements = 0;
let filesModified = 0;

function shouldSkip(filePath) {
  const rel = path.relative(DASHBOARD, filePath);
  return SKIP_FILES.some(s => rel.startsWith(s));
}

function processFile(filePath) {
  if (shouldSkip(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  const relPath = path.relative(ROOT, filePath);
  let replacements = 0;

  const isSvelte = filePath.endsWith('.svelte');
  const isTs = filePath.endsWith('.ts');

  // Skip server files
  if (filePath.includes('+layout.server') || filePath.includes('+page.server')) return;

  // ============================================================
  // PATTERN 1: sessionStorage.getItem('organizacionActualId')
  // ============================================================
  if (content.includes("sessionStorage.getItem('organizacionActualId')")) {
    // OnboardingChecklist pattern: organizacionId || (typeof sessionStorage !== 'undefined' ? ... : null)
    content = content.replace(
      /organizacionId \|\| \(typeof sessionStorage !== 'undefined' \? sessionStorage\.getItem\('organizacionActualId'\) : null\)/g,
      () => { replacements++; return "organizacionId || get(orgIdStore)?.toString() || null"; }
    );

    // const organizacionId = sessionStorage.getItem('organizacionActualId');
    content = content.replace(
      /const organizacionId = sessionStorage\.getItem\('organizacionActualId'\);/g,
      () => { replacements++; return "const organizacionId = get(orgIdStore)?.toString() || null;"; }
    );

    // const orgId = sessionStorage.getItem('organizacionActualId');
    content = content.replace(
      /const orgId = sessionStorage\.getItem\('organizacionActualId'\);/g,
      () => { replacements++; return "const orgId = get(orgIdStore)?.toString() || null;"; }
    );

    // organizacionId = sessionStorage.getItem('organizacionActualId') || '';
    content = content.replace(
      /organizacionId = sessionStorage\.getItem\('organizacionActualId'\) \|\| '';/g,
      () => { replacements++; return "organizacionId = get(orgIdStore)?.toString() || '';"; }
    );

    // sessionStorage.getItem('organizacionActualId') || '' (template or inline)
    content = content.replace(
      /sessionStorage\.getItem\('organizacionActualId'\) \|\| ''/g,
      () => { replacements++; return "get(orgIdStore)?.toString() || ''"; }
    );

    // Any remaining sessionStorage.getItem('organizacionActualId')
    content = content.replace(
      /sessionStorage\.getItem\('organizacionActualId'\)/g,
      () => { replacements++; return "get(orgIdStore)?.toString() || null"; }
    );
  }

  // ============================================================
  // PATTERN 2: JSON.parse(sessionStorage.getItem('userData') || '{}')
  // All dashboard files using this only access .organizacionId
  // ============================================================
  if (content.includes("sessionStorage.getItem('userData')")) {
    // JSON.parse(sessionStorage.getItem('userData') || '{}').organizacionId  (inline)
    content = content.replace(
      /JSON\.parse\(sessionStorage\.getItem\('userData'\) \|\| '{}'\)\.organizacionId/g,
      () => { replacements++; return "get(orgIdStore)"; }
    );

    // const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
    content = content.replace(
      /const userData = JSON\.parse\(sessionStorage\.getItem\('userData'\) \|\| '{}'\);/g,
      () => { replacements++; return "const userData = { organizacionId: get(orgIdStore) };"; }
    );

    // Remaining JSON.parse(sessionStorage.getItem('userData') || '{}')
    content = content.replace(
      /JSON\.parse\(sessionStorage\.getItem\('userData'\) \|\| '{}'\)/g,
      () => { replacements++; return "{ organizacionId: get(orgIdStore) }"; }
    );
  }

  // ============================================================
  // PATTERN 3: sessionStorage.setItem (remove entire line)
  // ============================================================
  content = content.replace(
    /[ \t]*sessionStorage\.setItem\('userData', JSON\.stringify\(userData\)\);\n/g,
    () => { replacements++; return ""; }
  );
  content = content.replace(
    /[ \t]*sessionStorage\.setItem\('organizacionActualId',[^;]+;\n/g,
    () => { replacements++; return ""; }
  );

  // ============================================================
  // PATTERN 4: sessionStorage.clear()
  // ============================================================
  content = content.replace(
    /[ \t]*sessionStorage\.clear\(\);\n/g,
    () => { replacements++; return ""; }
  );

  // ============================================================
  // PATTERN 5: Clean up comments referencing sessionStorage
  // ============================================================
  content = content.replace(
    /[ \t]*\/\/ Obtener organizacionId actual de sessionStorage\n/g,
    () => { replacements++; return ""; }
  );
  content = content.replace(
    /[ \t]*\/\/ Obtener organizacionId desde sessionStorage\n/g,
    () => { replacements++; return ""; }
  );
  content = content.replace(
    /[ \t]*\/\/ Obtener organizacionId del sessionStorage\n/g,
    () => { replacements++; return ""; }
  );
  content = content.replace(
    /[ \t]*\/\/ Actualizar sessionStorage con el organizacionId\n/g,
    () => { replacements++; return ""; }
  );
  content = content.replace(
    /console\.log\('❌ No hay organizacionId en sessionStorage'\)/g,
    () => { replacements++; return "console.log('❌ No hay organizacionId')"; }
  );
  content = content.replace(
    /\/\/ Obtener el rol del usuario de sessionStorage via request headers o validar en BD/g,
    () => { replacements++; return "// Validar rol del usuario en BD"; }
  );
  content = content.replace(
    /\/\/ Usar el prop o leer de sessionStorage como fallback/g,
    () => { replacements++; return "// Usar el prop o leer del store como fallback"; }
  );

  if (replacements > 0 && content !== original) {
    // ============================================================
    // ADD IMPORTS
    // ============================================================
    const needsOrgStore = content.includes('get(orgIdStore)');

    if (needsOrgStore) {
      if (isSvelte) {
        const scriptMatch = content.match(/(<script[^>]*>)\n/);
        if (scriptMatch) {
          const scriptTag = scriptMatch[1];
          let importsToAdd = '';

          // Add get from svelte/store
          if (!content.includes("from 'svelte/store'") && !content.includes('from "svelte/store"')) {
            importsToAdd += "  import { get } from 'svelte/store';\n";
          } else if (!content.match(/\bget\b.*from ['"]svelte\/store['"]/)) {
            // svelte/store is imported but 'get' might be missing
            content = content.replace(
              /import \{([^}]+)\} from ['"]svelte\/store['"]/,
              (m, imports) => {
                if (!imports.includes('get')) {
                  return `import {${imports.trimEnd()}, get } from 'svelte/store'`;
                }
                return m;
              }
            );
          }

          // Add orgIdStore import
          if (!content.includes("orgIdStore")) {
            importsToAdd += "  import { organizacionId as orgIdStore } from '$lib/stores/organizacion';\n";
          }

          if (importsToAdd) {
            content = content.replace(
              scriptTag + '\n',
              scriptTag + '\n' + importsToAdd
            );
          }
        }
      } else if (isTs) {
        let importsToAdd = '';
        if (!content.includes("from 'svelte/store'")) {
          importsToAdd += "import { get } from 'svelte/store';\n";
        }
        if (!content.includes("orgIdStore")) {
          importsToAdd += "import { organizacionId as orgIdStore } from '$lib/stores/organizacion';\n";
        }
        if (importsToAdd) {
          const lastImportIdx = content.lastIndexOf('\nimport ');
          if (lastImportIdx >= 0) {
            const lineEnd = content.indexOf('\n', lastImportIdx + 1);
            content = content.slice(0, lineEnd + 1) + importsToAdd + content.slice(lineEnd + 1);
          } else {
            content = importsToAdd + content;
          }
        }
      }
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ ${relPath} — ${replacements} replacements`);
    filesModified++;
    totalReplacements += replacements;
  } else if (content.includes('sessionStorage') && !shouldSkip(filePath)) {
    console.log(`⚠️ ${relPath} — still has sessionStorage references (not handled)`);
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.svelte') || entry.name.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir(DASHBOARD);

console.log(`\n📊 Total: ${totalReplacements} replacements in ${filesModified} files`);
console.log('\n⚠️ Manual migration needed for: usuarios, configuracion, organizaciones/nueva');
