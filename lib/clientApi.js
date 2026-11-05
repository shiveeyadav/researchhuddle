// Browser helper for JSON POST/GET calls to our API routes. Only call from event handlers/effects.
export async function postJson(url, data) {
  const resp = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data || {}),
  });
  let json = {};
  try {
    json = await resp.json();
  } catch (_) {
    json = {};
  }
  if (!resp.ok) {
    const err = new Error(json.error || `Request failed (${resp.status})`);
    err.status = resp.status;
    throw err;
  }
  return json;
}

export async function getJson(url) {
  const resp = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.error || `Request failed (${resp.status})`);
  return json;
}
