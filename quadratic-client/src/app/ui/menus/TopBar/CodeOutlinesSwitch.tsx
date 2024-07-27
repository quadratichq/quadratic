import { Switch } from '@mui/material';
import { styled } from '@mui/material/styles';

import { colors } from '@/app/theme/colors';

const CodeOutlinesSwitch = styled(Switch)(({ theme }) => {
  return {
    padding: '8px',
    '& .MuiSwitch-track': {
      borderRadius: 0,
      background: '#fff',
      border: `1px solid ${colors.darkGray}4d`, // hexadecimal opacity: 30%
      opacity: 1,

      '&:before, &:after': {
        content: '""',
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        width: 18,
        height: 18,
        backgroundSize: '18px',
      },
      '&:before': {
        backgroundImage: `url('data:image/svg+xml;utf8,<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="${encodeURIComponent(
          theme.palette.primary.main
        )}" d="M6.2998 13.5L1.7998 9L6.2998 4.5L7.25605 5.45625L3.7123 9L7.25605 12.5438L6.2998 13.5ZM11.6998 13.5L10.7436 12.5438L14.2873 9L10.7436 5.45625L11.6998 4.5L16.1998 9L11.6998 13.5Z" /></svg>')`,
        left: 12,
        opacity: 0,
      },
      '&:after': {
        backgroundImage: `url('data:image/svg+xml;utf8,<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="${encodeURIComponent(
          colors.darkGray
        )}" d="M14.4 16.3125L5.4 7.31255L3.7125 9.00005L7.25625 12.5438L6.3 13.5L1.8 9.00005L4.44375 6.3563L1.6875 3.60005L2.64375 2.6438L15.3563 15.3563L14.4 16.3125ZM13.5563 11.6438L12.6 10.6875L14.2875 9.00005L10.7438 5.4563L11.7 4.50005L16.2 9.00005L13.5563 11.6438Z" /></svg>')`,
        right: 12,
      },
    },
    '&.MuiSwitch-root .Mui-checked + .MuiSwitch-track': {
      opacity: 1,
      background: '#fff',

      '&:after': {
        opacity: 0,
      },
      '&:before': {
        opacity: 1,
      },
    },
    '& .MuiSwitch-thumb': {
      transition: '150ms ease opacity',
      background: colors.darkGray,
      boxShadow: 'none',
      width: 12,
      height: 12,
      margin: 4,
      borderRadius: 0,
    },
    '&:hover .MuiSwitch-thumb': {
      opacity: 1,
    },
    '& .Mui-checked .MuiSwitch-thumb': {
      background: theme.palette.primary.main,
    },
  };
});

export default CodeOutlinesSwitch;
