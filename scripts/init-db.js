#!/usr/bin/env node
// Applies db/schema.sql (idempotent). Retries while Postgres is starting up.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MAX_ATTEMPTS = Number(process.env.INIT_DB_ATTEMPTS || 30);
const DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[init-db] DATABASE_URL is not set');
    process.exit(1);
  }
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl });
    try {
      await client.connect();
      // Serialise concurrent starts (e.g. two replicas) with an advisory lock.
      await client.query('SELECT pg_advisory_lock(424242)');
      try {
        await client.query(sql);
      } finally {
        await client.query('SELECT pg_advisory_unlock(424242)');
      }
      console.log('[init-db] schema is up to date');
      await client.end();
      return;
    } catch (err) {
      await client.end().catch(() => {});
      const retryable = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', '57P03', 'ETIMEDOUT'].includes(err.code);
      if (!retryable || attempt === MAX_ATTEMPTS) {
        console.error('[init-db] failed:', err.message);
        process.exit(1);
      }
      console.log(`[init-db] database not ready (${err.code}), retry ${attempt}/${MAX_ATTEMPTS}...`);
      await sleep(DELAY_MS);
    }
  }
}

main();
