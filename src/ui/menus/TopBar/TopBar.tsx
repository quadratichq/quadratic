import { Box, Button, useMediaQuery, useTheme } from '@mui/material';
import { SheetController } from '../../../grid/controller/sheetController';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { electronMaximizeCurrentWindow } from '../../../helpers/electronMaximizeCurrentWindow';
import { focusGrid } from '../../../helpers/focusGrid';
import { useRootRouteLoaderData } from '../../../router';
import { colors } from '../../../theme/colors';
import { isElectron } from '../../../utils/isElectron';
import { TooltipHint } from '../../components/TooltipHint';
import CodeOutlinesSwitch from './CodeOutlinesSwitch';
import { DataMenu } from './SubMenus/DataMenu';
import { FormatMenu } from './SubMenus/FormatMenu/FormatMenu';
import { NumberFormatMenu } from './SubMenus/NumberFormatMenu';
import { QuadraticMenu } from './SubMenus/QuadraticMenu';
import { useGridSettings } from './SubMenus/useGridSettings';
import { TopBarFileMenu } from './TopBarFileMenu';
import { ZoomDropdown } from './ZoomDropdown';

interface IProps {
  app: PixiApp;
  sheetController: SheetController;
}

export const TopBar = (props: IProps) => {
  const { app, sheetController } = props;
  const theme = useTheme();
  const settings = useGridSettings();
  const { isAuthenticated } = useRootRouteLoaderData();
  // const { user } = useAuth0();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const showEditControls = isAuthenticated && isDesktop; // TODO and it's not read only

  return (
    <Box
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      sx={{
        backgroundColor: 'rgba(255, 255, 255)',
        px: theme.spacing(1),
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        border: colors.mediumGray,
        borderWidth: '0 0 1px 0',
        borderStyle: 'solid',
        height: theme.spacing(6),
        ...(isElectron()
          ? {
              paddingLeft: '4.5rem',
              // this allows the window to be dragged in Electron
              WebkitAppRegion: 'drag',
            }
          : {}),
      }}
      onDoubleClick={(event) => {
        // if clicked (not child clicked), maximize window. For electron.
        if (event.target === event.currentTarget) electronMaximizeCurrentWindow();
      }}
    >
      <div
        style={{
          //@ts-expect-error
          WebkitAppRegion: 'no-drag',
          display: 'flex',
          alignItems: 'center',
          color: theme.palette.text.secondary,
        }}
      >
        <QuadraticMenu sheetController={sheetController} />
        {showEditControls && (
          <>
            <DataMenu />
            <FormatMenu app={app} sheet_controller={sheetController} />
            <NumberFormatMenu app={app} sheet_controller={sheetController} />
          </>
        )}
      </div>

      <TopBarFileMenu />

      <div
        style={{
          // @ts-expect-error
          WebkitAppRegion: 'no-drag',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: theme.spacing(),
        }}
      >
        <Box
          sx={{
            [theme.breakpoints.down('md')]: {
              display: 'none',
            },
          }}
        >
          {isAuthenticated ? (
            <Button variant="contained" size="small" disableElevation>
              Share
            </Button>
          ) : (
            <Button variant="outlined" size="small" disableElevation>
              Log in
            </Button>
          )}
        </Box>
        {isDesktop && (
          <>
            {/* {user !== undefined && (
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
            )} */}
            <TooltipHint title={`${settings.showCellTypeOutlines ? 'Hide' : 'Show'} code cell outlines`}>
              <CodeOutlinesSwitch
                onClick={() => {
                  settings.setShowCellTypeOutlines(!settings.showCellTypeOutlines);
                  focusGrid();
                }}
                checked={settings.showCellTypeOutlines}
              />
            </TooltipHint>
          </>
        )}
        <ZoomDropdown app={app} />
      </div>
    </Box>
  );
};
