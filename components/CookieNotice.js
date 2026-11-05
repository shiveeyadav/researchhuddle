import Link from 'next/link';
import { useEffect, useState } from 'react';

const KEY = 'rh_cookie_notice_seen';

// Informational notice: we only use strictly necessary cookies, so no consent choice is required
// (PECR reg. 6 exemption). Dismissal is remembered in localStorage, not in a cookie.
export default function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setShow(true);
    } catch (_) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, '1');
    } catch (_) {
      /* storage blocked: just hide for this page view */
    }
    setShow(false);
  }

  return (
    <div className="cookie-notice" role="region" aria-label="Cookie notice">
      <p>
        We use only <strong>essential cookies</strong> to keep you signed in and to protect the ORCID sign-in
        from forgery. No analytics or advertising cookies. <Link href="/cookies">Cookie details</Link> ·{' '}
        <Link href="/privacy">Privacy notice</Link>
      </p>
      <button type="button" className="btn primary small" onClick={dismiss}>
        OK
      </button>
    </div>
  );
}
