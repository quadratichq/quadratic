import { Avatar, AvatarProps } from '@mui/material';

function stringToColor(string: string) {
  let hash = 0;
  let i;

  /* eslint-disable no-bitwise */
  for (i = 0; i < string.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }

  let color = '#';

  for (i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  /* eslint-enable no-bitwise */

  return color;
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

type Props = Omit<AvatarProps, 'children'> & {
  children: string;
  size?: 'small' | 'medium' | 'large';
};

export function AvatarWithLetters(props: Props) {
  const { sx, children, size, ...rest } = props;

  const modifiedProps = {
    sx: {
      ...(sx ? sx : {}),

      bgcolor: stringToColor(children),
      ...(size === 'small' ? { width: 24, height: 24, fontSize: '.75rem' } : {}),
      ...(size === 'medium' ? { width: 32, height: 32, fontSize: '1rem' } : {}),
      ...(size === 'large' ? { width: 40, height: 40, fontSize: '1.125rem' } : {}),
    },
    children: getLettersFromString(children),
    ...rest,
  };

  return <Avatar {...modifiedProps} />;
}
