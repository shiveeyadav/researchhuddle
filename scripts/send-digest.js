#!/usr/bin/env node
// Sends the weekly digest to opted-in users. Schedule weekly, e.g. host cron:
//   0 8 * * 1  docker compose exec -T app node scripts/send-digest.js
const { runDigest } = require('../lib/digest');
const { getPool } = require('../lib/db');

runDigest()
  .then((result) => {
    console.log('[digest] done', result);
    return getPool().end();
  })
  .catch((err) => {
    console.error('[digest] failed:', err);
    process.exit(1);
  });
