import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal hash router so the browser/Android back button works and the app
 * runs from file:// in the standalone build. Routes look like "#/map" or "#/lesson/u1-L1".
 */
export function useHashRoute(defaultRoute = 'map') {
  const read = () => window.location.hash.replace(/^#\/?/, '') || defaultRoute;
  const [route, setRoute] = useState(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useCallback((next: string, replace = false) => {
    const url = `#/${next}`;
    if (replace) {
      history.replaceState(null, '', url);
      setRoute(next);
    } else {
      window.location.hash = url;
    }
  }, []);

  const segments = route.split('/');
  return { route, segments, navigate };
}
