import '../styles/globals.css';
import Head from 'next/head';
import Layout from '../components/Layout';
import { AppContext } from '../components/AppContext';

const DEFAULT_SITE = { appUrl: '', orcidBase: 'https://orcid.org', orcidEnv: 'production' };

export default function App({ Component, pageProps }) {
  const ctx = { viewer: pageProps.viewer || null, site: pageProps.site || DEFAULT_SITE };
  return (
    <AppContext.Provider value={ctx}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </AppContext.Provider>
  );
}
