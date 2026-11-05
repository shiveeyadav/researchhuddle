// Server-only PostgreSQL access. Never import from client components.
const { Pool } = require('pg');

function getPool() {
  if (!global.__rhPool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined;
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl,
      max: Number(process.env.DB_POOL_MAX || 10),
    });
    pool.on('error', (err) => console.error('[db] idle client error:', err.message));
    global.__rhPool = pool; // survives dev hot reloads
  }
  return global.__rhPool;
}

function query(text, params) {
  return getPool().query(text, params);
}

async function tx(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, tx, getPool };
