import Link from 'next/link';
import { useEffect } from 'react';
import Seo from '../components/Seo';
import Avatar from '../components/Avatar';
import { postJson } from '../lib/clientApi';
import { withViewer } from '../lib/serverProps';
import { listNotifications } from '../lib/queries';
import { formatDateTime, truncate, displayName } from '../lib/format';

const TEXT = {
  like: 'liked your post',
  reply: 'replied',
  follow: 'started following you',
};

export default function NotificationsPage({ items }) {
  useEffect(() => {
    if (items.some((n) => !n.read_at)) postJson('/api/notifications/read', {}).catch(() => {});
  }, [items]);

  return (
    <>
      <Seo title="Notifications" noindex />
      <div className="narrow">
        <h1 className="page-title">Notifications</h1>
        {!items.length ? <p className="empty card">Nothing yet. Likes, replies and new followers show up here.</p> : null}
        <ul className="notif-list">
          {items.map((n) => {
            const actor = displayName({ name: n.actor_name, orcid: n.actor_orcid });
            return (
              <li key={n.id} className={`card notif${n.read_at ? '' : ' unread'}`}>
                <Avatar name={n.actor_name} orcid={n.actor_orcid} size={36} />
                <div>
                  <p>
                    <Link href={`/r/${n.actor_orcid}`}>
                      <strong>{actor}</strong>
                    </Link>{' '}
                    {TEXT[n.type] || n.type}
                    {n.post_id ? (
                      <>
                        {': '}
                        <Link href={`/p/${n.post_parent_id || n.post_id}`} className="muted">
                          “{truncate(n.post_excerpt, 100)}”
                        </Link>
                      </>
                    ) : null}
                  </p>
                  <p className="small muted">{formatDateTime(n.created_at)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

export const getServerSideProps = withViewer(async (ctx, viewer) => {
  if (!viewer) return { redirect: { destination: '/api/auth/orcid/login', permanent: false } };
  const items = await listNotifications(viewer.id);
  return { props: { items } };
});
