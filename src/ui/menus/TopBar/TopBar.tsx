import { Box, Typography } from '@mui/material';
import { Button, Tooltip } from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Avatar, AvatarGroup } from '@mui/material';
import { useAuth0 } from '@auth0/auth0-react';
import { Menu, MenuHeader, MenuItem, SubMenu } from '@szhsin/react-menu';

import { QuadraticMenu } from './SubMenus/QuadraticMenu';
import { FormatMenu } from './SubMenus/FormatMenu';
import { colors } from '../../../theme/colors';

import { isElectron } from '../../../utils/isElectron';
import { DataMenu } from './SubMenus/DataMenu';
import { NumberFormatMenu } from './SubMenus/NumberFormatMenu';
import { ZoomDropdown } from './ZoomDropdown';
import { electronMaximizeCurrentWindow } from '../../../helpers/electronMaximizeCurrentWindow';
import { isMobileOnly } from 'react-device-detect';

export const TopBar = () => {
  const { user, logout } = useAuth0();

  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      style={{
        backgroundColor: 'rgba(255, 255, 255)',
        color: '#212121',
        //@ts-expect-error
        WebkitAppRegion: 'drag', // this allows the window to be dragged in Electron
        paddingLeft: isElectron() ? '4.5rem' : '2rem',
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        paddingRight: '1rem',
        border: colors.mediumGray,
        borderWidth: '0 0 1px 0',
        borderStyle: 'solid',
      }}
      onDoubleClick={(event) => {
        // if clicked (not child clicked), maximize window. For electron.
        if (event.target === event.currentTarget) electronMaximizeCurrentWindow();
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
        {!isMobileOnly && (
          <>
            <DataMenu></DataMenu>
            <FormatMenu></FormatMenu>
            <NumberFormatMenu></NumberFormatMenu>
          </>
        )}
      </Box>

      {!isMobileOnly && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            userSelect: 'none',
          }}
        >
          <Typography variant="body2" fontFamily={'sans-serif'} color={colors.mediumGray}>
            Personal &nbsp;
          </Typography>
          <Typography variant="body2" fontFamily={'sans-serif'} color={colors.darkGray}>
            / Untitled.grid
          </Typography>
          <KeyboardArrowDown fontSize="small" style={{ color: colors.darkGray }}></KeyboardArrowDown>
        </Box>
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '1rem',
          width: '20rem',
        }}
      >
        <iframe
          src="https://ghbtns.com/github-btn.html?user=quadratichq&repo=quadratic&type=star&count=true"
          frameBorder="0"
          scrolling="0"
          width="90"
          height="20"
          title="GitHub"
          style={{
            userSelect: 'none',
            display: 'none',
          }}
        ></iframe>

        {!isMobileOnly && (
          <Tooltip title="Quadratic Cloud only" arrow>
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
        )}
        <ZoomDropdown></ZoomDropdown>

        {/* <AvatarGroup> */}
        <Menu
          menuButton={
            <Button>
              <Avatar
                sx={{
                  bgcolor: colors.quadraticPrimary,
                  width: 24,
                  height: 24,
                  fontSize: '0.9rem',
                }}
                srcSet={user?.picture}
              >
                You
              </Avatar>
            </Button>
          }
        >
          <MenuHeader>{user?.name}</MenuHeader>

          <MenuItem onClick={() => logout({ returnTo: window.location.origin })}>Log Out</MenuItem>
        </Menu>

        {/* </AvatarGroup> */}
      </Box>
    </div>
  );
};
