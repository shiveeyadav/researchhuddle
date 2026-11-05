// Server-only: ORCID OAuth 2.0 (authorization-code flow) and public-record import.
// Docs: https://info.orcid.org/documentation/api-tutorials/api-tutorial-get-and-authenticated-orcid-id/
const { orcidBase, orcidPubApi, appUrl } = require('./config');
const { isValidOrcid } = require('./orcid-id');
const { normaliseDoi, normaliseLink } = require('./validate');
const { tx } = require('./db');

const MAX_WORKS = 500;
const MAX_KEYWORDS = 30;
const FETCH_TIMEOUT_MS = 15000;

function redirectUri() {
  return `${appUrl()}/api/auth/orcid/callback`;
}

function authorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.ORCID_CLIENT_ID || '',
    response_type: 'code',
    scope: '/authenticate',
    redirect_uri: redirectUri(),
    state,
  });
  return `${orcidBase()}/oauth/authorize?${params.toString()}`;
}

// Exchanges an authorization code. ORCID returns { access_token, token_type, refresh_token,
// expires_in, scope, name, orcid }. We only need the authenticated iD and name.
async function exchangeCode(code) {
  if (!process.env.ORCID_CLIENT_ID || !process.env.ORCID_CLIENT_SECRET) {
    throw new Error('ORCID_CLIENT_ID / ORCID_CLIENT_SECRET are not configured');
  }
  const resp = await fetch(`${orcidBase()}/oauth/token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.ORCID_CLIENT_ID,
      client_secret: process.env.ORCID_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
    }).toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`ORCID token exchange failed (${resp.status}): ${data.error_description || data.error || 'unknown'}`);
  }
  const orcid = String(data.orcid || '').toUpperCase();
  if (!isValidOrcid(orcid)) throw new Error('ORCID token response did not contain a valid iD');
  return { orcid, name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 200) : null };
}

async function fetchPublicRecord(orcid) {
  if (!isValidOrcid(orcid)) throw new Error('Invalid ORCID iD');
  const resp = await fetch(`${orcidPubApi()}/${orcid}/record`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`ORCID public API returned ${resp.status}`);
  return resp.json();
}

const val = (o) => (o && typeof o === 'object' && o.value != null ? String(o.value) : null);
const clip = (s, n) => (s == null ? null : String(s).trim().slice(0, n) || null);

function collectDoi(...idLists) {
  for (const list of idLists) {
    const ids = (list && list['external-id']) || [];
    for (const id of ids) {
      if (String(id['external-id-type'] || '').toLowerCase() !== 'doi') continue;
      const raw = val(id['external-id-normalized']) || id['external-id-value'] || val(id['external-id-url']);
      const doi = normaliseDoi(raw);
      if (doi) return doi;
    }
  }
  return null;
}

const AFFILIATION_SECTIONS = [
  ['employments', 'employment-summary', 'employment'],
  ['educations', 'education-summary', 'education'],
  ['invited-positions', 'invited-position-summary', 'invited-position'],
  ['qualifications', 'qualification-summary', 'qualification'],
];

// Maps ORCID v3.0 record JSON to our profile shape. Missing/private sections are tolerated.
function parseRecord(rec) {
  const person = (rec && rec.person) || {};
  const nameObj = person.name || {};
  const credit = val(nameObj['credit-name']);
  const full = [val(nameObj['given-names']), val(nameObj['family-name'])].filter(Boolean).join(' ');
  const name = clip(credit || full, 200);

  const biography = clip(person.biography && person.biography.content, 5000);

  const keywords = [];
  for (const k of (person.keywords && person.keywords.keyword) || []) {
    // A single keyword entry sometimes holds a comma-separated list.
    for (const part of String(k.content || '').split(/[,;]/)) {
      const kw = part.trim().slice(0, 100);
      if (kw && !keywords.some((x) => x.toLowerCase() === kw.toLowerCase())) keywords.push(kw);
    }
  }

  const activities = (rec && rec['activities-summary']) || {};
  const affiliations = [];
  for (const [section, summaryKey, type] of AFFILIATION_SECTIONS) {
    for (const group of (activities[section] && activities[section]['affiliation-group']) || []) {
      const s = group.summaries && group.summaries[0] && group.summaries[0][summaryKey];
      if (!s || !s.organization) continue;
      const addr = s.organization.address || {};
      affiliations.push({
        type,
        organization: clip(s.organization.name, 300),
        department: clip(s['department-name'], 300),
        role: clip(s['role-title'], 300),
        city: clip(addr.city, 100),
        country: clip(addr.country, 10),
        startYear: val(s['start-date'] && s['start-date'].year),
        endYear: val(s['end-date'] && s['end-date'].year),
      });
    }
  }
  // Current positions first, then most recent.
  affiliations.sort((a, b) => (a.endYear ? 1 : 0) - (b.endYear ? 1 : 0) || Number(b.startYear || 0) - Number(a.startYear || 0));

  const works = [];
  for (const group of (activities.works && activities.works.group) || []) {
    const ws = group['work-summary'] && group['work-summary'][0]; // first = preferred version
    if (!ws) continue;
    const title = clip(ws.title && ws.title.title && ws.title.title.value, 1000);
    if (!title) continue;
    const yearStr = val(ws['publication-date'] && ws['publication-date'].year);
    const year = yearStr && /^\d{4}$/.test(yearStr) ? Number(yearStr) : null;
    works.push({
      putCode: ws['put-code'] != null ? String(ws['put-code']) : null,
      title,
      year,
      journal: clip(val(ws['journal-title']), 500),
      doi: collectDoi(ws['external-ids'], group['external-ids']),
      url: normaliseLink(val(ws.url)),
      type: clip(ws.type, 50),
    });
    if (works.length >= MAX_WORKS) break;
  }
  works.sort((a, b) => (b.year || 0) - (a.year || 0));

  return { name, biography, keywords: keywords.slice(0, MAX_KEYWORDS), affiliations: affiliations.slice(0, 50), works };
}

function affiliationText(affiliations) {
  return affiliations
    .map((a) => [a.organization, a.department, a.role].filter(Boolean).join(' '))
    .join(' | ')
    .slice(0, 5000);
}

// Imports (or refreshes) the public record for a user. Throws on network/API failure.
async function importRecord(userId, orcid) {
  const record = await fetchPublicRecord(orcid);
  const p = parseRecord(record);
  await tx(async (client) => {
    await client.query(
      `UPDATE users
          SET name = COALESCE($2, name),
              biography = $3,
              keywords = $4,
              affiliations = $5::jsonb,
              affiliation_text = $6,
              last_import_at = now(),
              import_error = NULL
        WHERE id = $1`,
      [userId, p.name, p.biography, p.keywords, JSON.stringify(p.affiliations), affiliationText(p.affiliations)]
    );
    await client.query('DELETE FROM works WHERE user_id = $1', [userId]);
    for (const w of p.works) {
      await client.query(
        `INSERT INTO works (user_id, put_code, title, year, journal, doi, url, work_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, w.putCode, w.title, w.year, w.journal, w.doi, w.url, w.type]
      );
    }
  });
  return p;
}

module.exports = { authorizeUrl, exchangeCode, fetchPublicRecord, parseRecord, importRecord, redirectUri };
