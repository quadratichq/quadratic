import { ensureHttpProtocol } from '@/app/helpers/links';
import { WebBrowserIcon } from '@/shared/components/Icons';
import type { ImgHTMLAttributes } from 'react';
import React, { forwardRef, memo } from 'react';

// Pull a favicon from https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${domain}&sz=${size}
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
    return new URL(ensureHttpProtocol(url)).toString();
  } catch (error) {
    console.error('Error parsing domain', error);
    return null;
  }
};

const parseSize = (size: number): string => {
  const intSize = Math.round(size);

  return intSize.toString();
};

export const Favicon = memo(
  forwardRef<HTMLImageElement, FaviconProps>(({ domain, size, alt, className, style, ...rest }, ref) => {
    const [error, setError] = React.useState(false);
    const fallback = <WebBrowserIcon className={className} />;
    const parsedDomain = parseDomainFromUrl(domain);
    const parsedSize = parseSize(size);

    if (!parsedDomain) {
      return fallback;
    }

    return (
      <>
        {!!error ? (
          fallback
        ) : (
          <img
            alt={alt}
            ref={ref}
            src={`https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${parsedDomain}&sz=${parsedSize}`}
            onError={() => setError(true)}
            style={style}
            className={className}
            {...rest}
          />
        )}
      </>
    );
  })
);
