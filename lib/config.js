// Server-side configuration helpers (read from environment at runtime).

function orcidEnv() {
  return String(process.env.ORCID_ENV || 'production').toLowerCase() === 'sandbox' ? 'sandbox' : 'production';
}

// Base for OAuth endpoints and human-facing record links.
function orcidBase() {
  return orcidEnv() === 'sandbox' ? 'https://sandbox.orcid.org' : 'https://orcid.org';
}

// Public API (read-public) base.
function orcidPubApi() {
  return orcidEnv() === 'sandbox' ? 'https://pub.sandbox.orcid.org/v3.0' : 'https://pub.orcid.org/v3.0';
}

function appUrl() {
  return String(process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function isSecureApp() {
  return appUrl().startsWith('https://');
}

function adminOrcids() {
  return new Set(
    String(process.env.ADMIN_ORCIDS || '')
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );
}

function isAdminOrcid(orcid) {
  return adminOrcids().has(String(orcid || '').toUpperCase());
}

module.exports = { orcidEnv, orcidBase, orcidPubApi, appUrl, isSecureApp, adminOrcids, isAdminOrcid };
