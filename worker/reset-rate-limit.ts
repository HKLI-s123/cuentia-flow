import { pool } from './db.js';

async function main() {

  // Count today's gestiones
  const countResult = await pool.query(`
    SELECT COUNT(*) AS total
    FROM GestionesCobranza gc
    INNER JOIN Facturas f ON gc.facturaid = f.id
    INNER JOIN Clientes c ON f.clienteid = c.id
    WHERE REPLACE(REPLACE(REPLACE(REPLACE(c.telefonowhatsapp, ' ', ''), '-', ''), '(', ''), ')', '') LIKE '%6564053919'
      AND c.organizacionid = 45
      AND CAST(gc.fechagestion AS DATE) = CAST(NOW() AS DATE)
  `);
  console.log('Gestiones hoy ANTES:', countResult.rows[0].total);

  // Delete test gestiones from today (keep only the first 2)
  const deleteResult = await pool.query(`
    DELETE FROM GestionesCobranza
    WHERE Id IN (
      SELECT gc.id
      FROM GestionesCobranza gc
      INNER JOIN Facturas f ON gc.facturaid = f.id
      INNER JOIN Clientes c ON f.clienteid = c.id
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(c.telefonowhatsapp, ' ', ''), '-', ''), '(', ''), ')', '') LIKE '%6564053919'
        AND c.organizacionid = 45
        AND CAST(gc.fechagestion AS DATE) = CAST(NOW() AS DATE)
        AND (gc.descripcion LIKE 'CLIENTE:%' OR gc.descripcion LIKE 'AGENTE_IA:%')
        AND gc.tipogestion IN ('respuesta_cliente', 'respuesta_agente_ia')
    )
  `);
  console.log('Gestiones eliminadas:', deleteResult.rowCount);

  // Count after
  const afterResult = await pool.query(`
    SELECT COUNT(*) AS total
    FROM GestionesCobranza gc
    INNER JOIN Facturas f ON gc.facturaid = f.id
    INNER JOIN Clientes c ON f.clienteid = c.id
    WHERE REPLACE(REPLACE(REPLACE(REPLACE(c.telefonowhatsapp, ' ', ''), '-', ''), '(', ''), ')', '') LIKE '%6564053919'
      AND c.organizacionid = 45
      AND CAST(gc.fechagestion AS DATE) = CAST(NOW() AS DATE)
  `);
  console.log('Gestiones hoy DESPUÉS:', afterResult.rows[0].total);

  await pool.end();
}

main().catch(console.error);
