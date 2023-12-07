import { useSearchParams } from 'react-router-dom';

/**
 * This hook can be used in various places to determine whether the app
 * is currently in "embed" mode (which is derived from a URL search param)
 */
export function useIsEmbed() {
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') !== null;
  return isEmbed;
}
