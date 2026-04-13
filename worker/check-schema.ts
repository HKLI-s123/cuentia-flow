import 'dotenv/config';
import { getConnection } from './db.js';

async function main() {
  const pool = await getConnection();

  // Ver factura 3748
  const r = await pool.query(`
    SELECT f.id, f.numero_factura, f.montototal, f.saldopendiente, f.fechavencimiento, 
           f.estado_factura_id, f.agenteiaactivo, 
           c.nombrecomercial, c.telefonowhatsapp, c.organizacionid
    FROM Facturas f INNER JOIN Clientes c ON f.clienteid = c.id
    WHERE f.id = 3748
  `);
  console.log('--- Factura 3748 ---');
  console.log(r.rows);

  // Activar agente IA
  await pool.query('UPDATE Facturas SET AgenteIAActivo = true WHERE Id = 3748');
  console.log('\n✅ AgenteIAActivo = 1 activado en factura 3748');

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
