import { Box, Typography, Button, Tooltip, AvatarGroup, Avatar } from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';

import { QuadraticMenu } from './SubMenus/QuadraticMenu';
import { FormatMenu } from './SubMenus/FormatMenu';
import { colors } from '../../../theme/colors';

import { DataMenu } from './SubMenus/DataMenu';
import { NumberFormatMenu } from './SubMenus/NumberFormatMenu';
import { ZoomDropdown } from './ZoomDropdown';
import { isMobileOnly } from 'react-device-detect';
import { useAuth0 } from '@auth0/auth0-react';
import { TopBar } from '../../components/TopBar';

export const AppTopBar = () => {
  const { user } = useAuth0();

  return (
    <TopBar>
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
        {!isMobileOnly && (
          <>
            <DataMenu></DataMenu>
            <FormatMenu></FormatMenu>
            <NumberFormatMenu></NumberFormatMenu>
          </>
        )}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          userSelect: 'none',
        }}
      >
        {isMobileOnly ? (
          <Typography
            variant="body2"
            fontFamily={'sans-serif'}
            color={colors.mediumGray}
            style={{ whiteSpace: 'nowrap', marginLeft: '1rem' }}
          >
            Read Only
          </Typography>
        ) : (
          <>
            <Typography variant="body2" fontFamily={'sans-serif'} color={colors.mediumGray}>
              Personal &nbsp;
            </Typography>
            <Typography variant="body2" fontFamily={'sans-serif'} color={colors.darkGray}>
              / Untitled.grid
            </Typography>
            <KeyboardArrowDown fontSize="small" style={{ color: colors.darkGray }}></KeyboardArrowDown>
          </>
        )}
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '1rem',
          width: '20rem',
        }}
      >
        {!isMobileOnly && (
          <>
            <AvatarGroup>
              <Avatar
                sx={{
                  bgcolor: colors.quadraticSecondary,
                  width: 24,
                  height: 24,
                  fontSize: '0.8rem',
                }}
                alt={user?.name}
                src={user?.picture}
              >
                {user?.name && user?.name[0]}
              </Avatar>
            </AvatarGroup>
            <Tooltip title="Coming Soon" arrow>
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
            </Tooltip>
          </>
        )}
        <ZoomDropdown></ZoomDropdown>
      </Box>
    </TopBar>
  );
};
