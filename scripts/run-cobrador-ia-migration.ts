import sql from 'mssql';
import 'dotenv/config';

const config: sql.config = {
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  server: process.env.DB_SERVER!,
  database: process.env.DB_NAME!,
  options: { encrypt: true, trustServerCertificate: false }
};

async function migrate() {
  const pool = await sql.connect(config);
  console.log('Connected to database');

  // 1. AutoComplementoPago on Clientes
  try {
    await pool.query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Clientes' AND COLUMN_NAME = 'AutoComplementoPago')
      ALTER TABLE Clientes ADD AutoComplementoPago BIT NOT NULL DEFAULT 0
    `);
    console.log('OK: AutoComplementoPago on Clientes');
  } catch (e: any) { console.error('ERR:', e.message); }

  // 2. ComprobantePagoRecibido on GestionesCobranza
  try {
    await pool.query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'GestionesCobranza' AND COLUMN_NAME = 'ComprobantePagoRecibido')
      ALTER TABLE GestionesCobranza ADD ComprobantePagoRecibido BIT NOT NULL DEFAULT 0
    `);
    console.log('OK: ComprobantePagoRecibido on GestionesCobranza');
  } catch (e: any) { console.error('ERR:', e.message); }

  // 3. PagoConfirmado on GestionesCobranza
  try {
    await pool.query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'GestionesCobranza' AND COLUMN_NAME = 'PagoConfirmado')
      ALTER TABLE GestionesCobranza ADD PagoConfirmado BIT NOT NULL DEFAULT 0
    `);
    console.log('OK: PagoConfirmado on GestionesCobranza');
  } catch (e: any) { console.error('ERR:', e.message); }

  // 4. MotivoEscalamiento on GestionesCobranza
  try {
    await pool.query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'GestionesCobranza' AND COLUMN_NAME = 'MotivoEscalamiento')
      ALTER TABLE GestionesCobranza ADD MotivoEscalamiento NVARCHAR(500) NULL
    `);
    console.log('OK: MotivoEscalamiento on GestionesCobranza');
  } catch (e: any) { console.error('ERR:', e.message); }

  await pool.close();
  console.log('Migration complete!');
}

migrate().catch(e => { console.error(e); process.exit(1); });
