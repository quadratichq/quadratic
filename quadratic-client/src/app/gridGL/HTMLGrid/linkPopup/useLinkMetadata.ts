import { ensureHttpProtocol } from '@/app/helpers/links';
import { apiClient } from '@/shared/api/apiClient';
import { useEffect, useRef, useState } from 'react';

// Simple in-memory cache for metadata to avoid refetching
const metadataCache = new Map<string, { title?: string }>();

/**
 * Fetch URL metadata (title) via our backend API.
 */
async function fetchUrlMetadata(url: string): Promise<{ title?: string }> {
  if (metadataCache.has(url)) {
    return metadataCache.get(url)!;
  }

  try {
    const result = await apiClient.urlMetadata.get(url);
    metadataCache.set(url, result);
    return result;
  } catch {
    return {};
  }
}

/**
 * Extract domain from URL for display
 */
export function getDomainFromUrl(url: string): string {
  try {
    return new URL(ensureHttpProtocol(url)).hostname;
  } catch {
    return url;
  }
}

/**
 * Hook to fetch and cache page metadata (title) for a URL
 */
export function useLinkMetadata(url: string | undefined) {
  const [pageTitle, setPageTitle] = useState<string | undefined>();
  const urlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!url) {
      setPageTitle(undefined);
      return;
    }

    urlRef.current = url;
    setPageTitle(undefined);

    fetchUrlMetadata(url).then((metadata) => {
      // Only update if this is still the current URL
      if (urlRef.current === url) {
        setPageTitle(metadata.title);
      }
    });
  }, [url]);

  return { pageTitle };
}
