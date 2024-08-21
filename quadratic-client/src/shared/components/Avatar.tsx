import React, { ImgHTMLAttributes } from 'react';

interface AvatarProps extends ImgHTMLAttributes<HTMLImageElement> {
  size?: 'small' | 'medium' | 'large';
  fallbackSrc?: string;
  children?: string | React.ReactNode;
}

export const Avatar: React.FC<AvatarProps> = ({ fallbackSrc, src, alt, size, style, children, ...rest }) => {
  const [error, setError] = React.useState(false);

  const stylePreset = {
    width: size === 'small' ? '24px' : size === 'medium' ? '32px' : size === 'large' ? '40px' : '24px',
    height: size === 'small' ? '24px' : size === 'medium' ? '32px' : size === 'large' ? '40px' : '24px',
    fontSize: size === 'small' ? '0.75rem' : size === 'medium' ? '1rem' : size === 'large' ? '1.125rem' : '0.8125rem',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    backgroundColor: '#BDBDBD',
  };

  return (
    <>
      {error ? (
        <span style={{ ...stylePreset, ...style }}>
          {typeof children === 'string' ? getLettersFromString(children) : children}
        </span>
      ) : (
        <img
          alt={alt}
          src={error ? fallbackSrc : src ?? ''}
          onError={() => setError(true)}
          style={{ ...stylePreset, ...style }}
          {...rest}
        />
      )}
    </>
  );
};

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
