// Server-only wrapper for getServerSideProps that adds `viewer` (signed-in user or null)
// and `site` (public config: appUrl, orcidBase, orcidEnv) to page props.
const { getSessionUser } = require('./session');
const { unreadCount } = require('./queries');
const { orcidBase, orcidEnv, appUrl } = require('./config');

async function loadViewer(req) {
  const user = await getSessionUser(req);
  if (!user) return null;
  return {
    id: String(user.id),
    orcid: user.orcid,
    name: user.name || null,
    isAdmin: !!user.is_admin,
    unread: await unreadCount(user.id),
  };
}

function withViewer(fn) {
  return async function getServerSideProps(ctx) {
    const viewer = await loadViewer(ctx.req);
    if (viewer) ctx.res.setHeader('Cache-Control', 'private, no-store');
    const result = fn ? await fn(ctx, viewer) : { props: {} };
    if (result && result.props) {
      result.props = { ...result.props, viewer, site: { appUrl: appUrl(), orcidBase: orcidBase(), orcidEnv: orcidEnv() } };
    }
    return result;
  };
}

module.exports = { withViewer, loadViewer };
