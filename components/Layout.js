import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import CookieNotice from './CookieNotice';
import { useApp } from './AppContext';

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="15" fill="#0f5e66" />
      <circle cx="11" cy="12" r="3.2" fill="#9be3d6" />
      <circle cx="21" cy="12" r="3.2" fill="#ffd27a" />
      <circle cx="16" cy="21" r="3.2" fill="#f4a3b4" />
      <path d="M11 12 L21 12 L16 21 Z" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.7" />
    </svg>
  );
}

export default function Layout({ children }) {
  const { viewer, site } = useApp();
  const router = useRouter();
  const [q, setQ] = useState(typeof router.query.q === 'string' ? router.query.q : '');

  function onSearch(e) {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <Logo />
            <span>ResearchHuddle</span>
          </Link>
          <form className="topsearch" onSubmit={onSearch} role="search">
            <label htmlFor="top-q" className="sr-only">
              Search researchers
            </label>
            <input
              id="top-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search researchers, keywords, institutions"
              maxLength={100}
            />
          </form>
          <nav className="nav" aria-label="Main">
            <Link href="/">Home</Link>
            <Link href="/?tab=latest">Latest</Link>
            {viewer ? (
              <>
                <Link href="/notifications" className="nav-notif">
                  Notifications
                  {viewer.unread ? <span className="badge">{viewer.unread > 99 ? '99+' : viewer.unread}</span> : null}
                </Link>
                <Link href={`/r/${viewer.orcid}`}>Profile</Link>
                <Link href="/settings">Settings</Link>
                {viewer.isAdmin ? <Link href="/admin">Admin</Link> : null}
                <form method="post" action="/api/auth/logout" className="inline-form">
                  <button type="submit" className="linklike">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <a href="/api/auth/orcid/login" className="btn orcid-btn small">
                Sign in with ORCID
              </a>
            )}
          </nav>
        </div>
      </header>
      {site && site.orcidEnv === 'sandbox' ? (
        <div className="sandbox-banner">ORCID sandbox mode - test accounts only.</div>
      ) : null}
      <main className="container">{children}</main>
      <footer className="footer">
        <div className="container footer-inner">
          <span>© ResearchHuddle</span>
          <Link href="/privacy">Privacy notice</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/search">Find researchers</Link>
          <span className="muted small">Identity verified with ORCID. ResearchHuddle is not affiliated with ORCID, Inc.</span>
        </div>
      </footer>
      <CookieNotice />
    </div>
  );
}
