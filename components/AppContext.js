import { createContext, useContext } from 'react';

// { viewer: {id, orcid, name, isAdmin, unread} | null, site: {appUrl, orcidBase, orcidEnv} }
export const AppContext = createContext({ viewer: null, site: { orcidBase: 'https://orcid.org' } });

export function useApp() {
  return useContext(AppContext);
}
