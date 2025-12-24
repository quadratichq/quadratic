import { useEffect, useRef, useState } from 'react';

// Simple in-memory cache for metadata to avoid refetching
const metadataCache = new Map<string, { title?: string; description?: string }>();

/**
 * Fetch metadata from microlink.io.
 * Note: we should pay for the api before shipping this feature.
 */
async function fetchUrlMetadata(url: string): Promise<{ title?: string; description?: string }> {
  if (metadataCache.has(url)) {
    return metadataCache.get(url)!;
  }

  try {
    const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return {};

    const data = await response.json();
    const result = {
      title: data?.data?.title,
      description: data?.data?.description,
    };

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
    const urlWithProtocol = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    return new URL(urlWithProtocol).hostname;
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
