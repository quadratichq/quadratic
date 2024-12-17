import { useMemo } from 'react';

export const UrlPill = ({ url }: { url: string }) => {
  const domain = useMemo(() => getDomainFromUrl(url), [url]);
  if (!domain) {
    return null;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex max-w-fit flex-row items-center gap-2 rounded-md border border-border px-2 py-1"
    >
      <img
        alt="Source website icon"
        className="h-4 w-4"
        src={`https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${url}&size=16`}
      />
      <span className="truncate">{domain}</span>
    </a>
  );
};

function getDomainFromUrl(url: string): string | null {
  try {
    const urlObject = new URL(url);
    return urlObject.hostname.replace(/^www\./, '');
  } catch (e) {
    return null;
  }
}
