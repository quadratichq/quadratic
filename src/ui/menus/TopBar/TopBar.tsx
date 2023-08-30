import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useRecoilValue } from 'recoil';
import { isEditorOrAbove } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { SheetController } from '../../../grid/controller/sheetController';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { electronMaximizeCurrentWindow } from '../../../helpers/electronMaximizeCurrentWindow';
import { colors } from '../../../theme/colors';
import { isElectron } from '../../../utils/isElectron';
import { DataMenu } from './SubMenus/DataMenu';
import { FormatMenu } from './SubMenus/FormatMenu/FormatMenu';
import { NumberFormatMenu } from './SubMenus/NumberFormatMenu';
import { QuadraticMenu } from './SubMenus/QuadraticMenu';
import { TopBarCodeOutlinesSwitch } from './TopBarCodeOutlinesSwitch';
import { TopBarFileMenu } from './TopBarFileMenu';
import { TopBarShareButton } from './TopBarShareButton';
import { TopBarUsers } from './TopBarUsers';
import { TopBarZoomMenu } from './TopBarZoomMenu';

interface IProps {
  app: PixiApp;
  sheetController: SheetController;
}

export const TopBar = (props: IProps) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { permission } = editorInteractionState;
  const { app, sheetController } = props;

  return (
    <Box
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      sx={{
        backgroundColor: 'rgba(255, 255, 255)',
        // px: theme.spacing(1),
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        gap: theme.spacing(1),
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
          alignItems: 'stretch',
          color: theme.palette.text.primary,
          ...(isDesktop ? { flexBasis: '30%' } : {}),
        }}
      >
        <QuadraticMenu sheetController={sheetController} />
        {isEditorOrAbove(permission) && isDesktop && (
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
          alignItems: 'stretch',
          justifyContent: 'flex-end',
          gap: theme.spacing(),
          color: theme.palette.text.primary,
          ...(isDesktop ? { flexBasis: '30%' } : {}),
        }}
      >
        {isDesktop && (
          <>
            <TopBarCodeOutlinesSwitch />
            <TopBarUsers />
            <TopBarShareButton />
          </>
        )}
        <TopBarZoomMenu app={app} />
      </div>
    </Box>
  );
};
