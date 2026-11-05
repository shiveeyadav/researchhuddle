import Head from 'next/head';

const SITE = 'ResearchHuddle';
const DEFAULT_DESC =
  'ResearchHuddle is a social network for scientists and researchers. Sign in with your ORCID iD, share findings, discuss papers and follow colleagues.';

/**
 * props: title, description, canonical (absolute URL), noindex, type, jsonLd (object)
 */
export default function Seo({ title, description, canonical, noindex, type, jsonLd }) {
  const fullTitle = title ? `${title} · ${SITE}` : `${SITE} - the research community, verified by ORCID`;
  const desc = description || DEFAULT_DESC;
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {noindex ? <meta name="robots" content="noindex, nofollow" /> : null}
      {canonical ? <link rel="canonical" href={canonical} /> : null}
      <meta property="og:site_name" content={SITE} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content={type || 'website'} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      {jsonLd ? (
        <script
          type="application/ld+json"
          // Escape "<" so user content cannot close the script tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      ) : null}
    </Head>
  );
}
