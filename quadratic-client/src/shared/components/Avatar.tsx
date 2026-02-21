import { cn } from '@/shared/shadcn/utils';
import type { ImgHTMLAttributes } from 'react';
import React, { forwardRef, memo, useCallback, useMemo } from 'react';

interface AvatarProps extends ImgHTMLAttributes<HTMLImageElement> {
  size?: 'xs' | 'small' | 'medium' | 'large';
  children?: string | React.ReactNode;
}
export const Avatar = memo(
  forwardRef<HTMLImageElement, AvatarProps>(({ src, alt, size, style, className, children, ...rest }, ref) => {
    const [error, setError] = React.useState(false);

    const stylePreset = useMemo(() => getStylePreset(size), [size]);

    const handleError = useCallback(() => {
      setError(true);
    }, []);

    return (
      <>
        {error || !src ? (
          <span
            ref={ref}
            className={cn(className, 'shrink-0 bg-muted-foreground text-background')}
            style={{ ...stylePreset, ...style }}
            {...rest}
          >
            {typeof children === 'string' ? getLettersFromString(children) : children}
          </span>
        ) : (
          <img
            alt={alt}
            ref={ref}
            src={src}
            onError={handleError}
            style={{ ...stylePreset, objectFit: 'cover', ...style }}
            className={cn('max-w-none shrink-0', className)}
            {...rest}
          />
        )}
      </>
    );
  })
);

function getStylePreset(size: AvatarProps['size']) {
  return {
    width:
      size === 'xs'
        ? '20px'
        : size === 'small'
          ? '24px'
          : size === 'medium'
            ? '32px'
            : size === 'large'
              ? '40px'
              : '24px',
    height:
      size === 'xs'
        ? '20px'
        : size === 'small'
          ? '24px'
          : size === 'medium'
            ? '32px'
            : size === 'large'
              ? '40px'
              : '24px',
    fontSize:
      size === 'xs'
        ? '0.625rem'
        : size === 'small'
          ? '0.75rem'
          : size === 'medium'
            ? '1rem'
            : size === 'large'
              ? '1.125rem'
              : '0.8125rem',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

function getLettersFromString(str: string) {
  let [first, last] = str.split(' ');

  if (first && last) {
    return first[0].toUpperCase() + last[0].toUpperCase();
  } else if (first) {
    return first[0].toUpperCase();
  } else {
    return '?';
  }
}
