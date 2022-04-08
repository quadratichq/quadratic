import { Box, Typography } from '@mui/material';
import { Button } from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Avatar, AvatarGroup } from '@mui/material';

import { QuadraticMenu } from './SubMenus/QuadraticMenu';
import { FormatMenu } from './SubMenus/FormatMenu';
import colors from '../../../theme/colors';

import { isElectron } from '../../../utils/isElectron';
import { DataMenu } from './SubMenus/DataMenu';
import { NumberFormatMenu } from './SubMenus/NumberFormatMenu';
import { ZoomDropdown } from './ZoomDropdown';

export const TopBar = () => {
  return (
    <Box
      style={{
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        color: '#212121',
        //@ts-expect-error
        WebkitAppRegion: 'drag', // this allows the window to be dragged in Electron
        paddingLeft: isElectron() ? '4.5rem' : '2rem',
        backdropFilter: 'blur(1px)',
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        paddingRight: '1rem',
      }}
    >
      <Box
        style={{
          //@ts-expect-error
          WebkitAppRegion: 'no-drag',
          display: 'flex',
          alignItems: 'center',
          width: '15rem',
        }}
      >
        <QuadraticMenu></QuadraticMenu>
        <DataMenu></DataMenu>
        <FormatMenu></FormatMenu>
        <NumberFormatMenu></NumberFormatMenu>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          userSelect: 'none',
        }}
      >
        <Typography
          variant="body2"
          fontFamily={'sans-serif'}
          color={colors.mediumGray}
        >
          Personal &nbsp;
        </Typography>
        <Typography
          variant="body2"
          fontFamily={'sans-serif'}
          color={colors.darkGray}
        >
          / PythonExample.grid
        </Typography>
        <KeyboardArrowDown
          fontSize="small"
          style={{ color: colors.darkGray }}
        ></KeyboardArrowDown>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          width: '15rem',
        }}
      >
        <AvatarGroup>
          <Avatar
            sx={{
              bgcolor: colors.quadraticPrimary,
              width: 24,
              height: 24,
              fontSize: '0.9rem',
            }}
          >
            DK
          </Avatar>
          <Avatar
            sx={{
              bgcolor: colors.quadraticSecondary,
              width: 24,
              height: 24,
              fontSize: '0.9rem',
            }}
          >
            OP
          </Avatar>
        </AvatarGroup>
        <Button
          style={{
            color: colors.darkGray,
            borderColor: colors.darkGray,
            padding: '1px 4px',
          }}
          variant="outlined"
          size="small"
        >
          Share
        </Button>
        <ZoomDropdown></ZoomDropdown>
      </Box>
    </Box>
  );
};
