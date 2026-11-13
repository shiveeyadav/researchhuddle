// Pure helpers, safe for both server and browser.

// Validates format and the ISO 7064 MOD 11-2 checksum of an ORCID iD.
function isValidOrcid(id) {
  if (typeof id !== 'string' || !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(id)) return false;
  const digits = id.replace(/-/g, '');
  let total = 0;
  for (let i = 0; i < 15; i++) total = (total + Number(digits[i])) * 2;
  const result = (12 - (total % 11)) % 11;
  const check = result === 10 ? 'X' : String(result);
  return check === digits[15];
}

// Accepts the bare iD or a pasted profile URL ("https://orcid.org/0000-...", "orcid.org/0000-...").
function normaliseOrcid(id) {
  return String(id || '')
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?orcid\.org\//i, '')
    .replace(/\/+$/, '')
    .toUpperCase();
}

module.exports = { isValidOrcid, normaliseOrcid };
