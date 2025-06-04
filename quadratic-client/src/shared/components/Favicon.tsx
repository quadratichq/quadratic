import { WebBrowserIcon } from '@/shared/components/Icons';
import type { ImgHTMLAttributes } from 'react';
import React, { forwardRef } from 'react';

// Pull a favicon from https://www.google.com/s2/favicons?domain=${domain}&sz=${size}
// If the favicon fails to load, fallback to a <WebBrowserIcon className={className} />

interface FaviconProps extends ImgHTMLAttributes<HTMLImageElement> {
  domain: string;
  size: number;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

const parseDomainFromUrl = (url: string): string | null => {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return null;
  }
};

const parseSize = (size: number): string => {
  const intSize = Math.round(size);

  return intSize.toString();
};

export const Favicon = forwardRef<HTMLImageElement, FaviconProps>(
  ({ domain, size, alt, className, style, ...rest }, ref) => {
    const [error, setError] = React.useState(false);
    const fallback = <WebBrowserIcon className={className} />;
    const parsedDomain = parseDomainFromUrl(domain);
    const parsedSize = parseSize(size);

    if (!parsedDomain) {
      return fallback;
    }

    return (
      <>
        {error ? (
          fallback
        ) : (
          <img
            alt={alt}
            ref={ref}
            src={`https://www.google.com/s2/favicons?domain=${parsedDomain}&sz=${parsedSize}`}
            crossOrigin="anonymous"
            onError={() => setError(true)}
            style={style}
            className={className}
            {...rest}
          />
        )}
      </>
    );
  }
);
