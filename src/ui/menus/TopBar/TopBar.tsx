import { Box, Typography } from '@mui/material';
import { Button, Tooltip } from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
// import { Avatar, AvatarGroup } from '@mui/material';

import { QuadraticMenu } from './SubMenus/QuadraticMenu';
import { FormatMenu } from './SubMenus/FormatMenu';
import { colors } from '../../../theme/colors';

import { isElectron } from '../../../utils/isElectron';
import { DataMenu } from './SubMenus/DataMenu';
import { NumberFormatMenu } from './SubMenus/NumberFormatMenu';
import { ZoomDropdown } from './ZoomDropdown';
import { electronMaximizeFocusedWindow } from '../../../helpers/electronMaximizeFocusedWindow';

export const TopBar = () => {
  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      style={{
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255)',
        color: '#212121',
        //@ts-expect-error
        WebkitAppRegion: 'drag', // this allows the window to be dragged in Electron
        paddingLeft: isElectron() ? '4.5rem' : '2rem',
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        paddingRight: '1rem',
      }}
      onDoubleClick={(event) => {
        // if clicked (not child clicked), maximize window. For electron.
        if (event.target === event.currentTarget)
          electronMaximizeFocusedWindow();
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
          / Untitled.grid
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
          justifyContent: 'flex-end',
          gap: '1rem',
          width: '20rem',
        }}
      >
        {/* <AvatarGroup>
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
            You
          </Avatar>
        </AvatarGroup> */}

        <iframe
          src="https://ghbtns.com/github-btn.html?user=quadratichq&repo=quadratic&type=star&count=true"
          frameBorder="0"
          scrolling="0"
          width="90"
          height="20"
          title="GitHub"
          style={{
            userSelect: 'none',
          }}
        ></iframe>

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
        <ZoomDropdown></ZoomDropdown>
      </Box>
    </div>
  );
};
