import sql from 'mssql';

const pool = await sql.connect({
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  server: process.env.DB_SERVER!,
  database: process.env.DB_NAME!,
  options: { encrypt: true, trustServerCertificate: false }
});

// Limpiar por factura
const r1 = await pool.request().query(`
  DELETE FROM GestionesCobranza 
  WHERE FacturaId = 3756 
    AND CAST(FechaGestion AS DATE) = CAST(GETDATE() AS DATE)
`);
console.log('Gestiones por factura 3756:', r1.rowsAffected[0]);

// Limpiar por teléfono del cliente (el worker valida por teléfono)
const r2 = await pool.request().query(`
  DELETE gc FROM GestionesCobranza gc
  INNER JOIN Facturas f ON gc.FacturaId = f.Id
  INNER JOIN Clientes c ON f.ClienteId = c.Id
  WHERE REPLACE(REPLACE(REPLACE(REPLACE(c.TelefonoWhatsApp, ' ', ''), '-', ''), '(', ''), ')', '') 
        LIKE '%6564053919'
    AND CAST(gc.FechaGestion AS DATE) = CAST(GETDATE() AS DATE)
`);
console.log('Gestiones por teléfono 6564053919:', r2.rowsAffected[0]);
await pool.close();
