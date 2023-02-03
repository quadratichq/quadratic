import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Avatar, AvatarGroup, Box, Button, Tooltip, Typography } from '@mui/material';
// import { Avatar, AvatarGroup } from '@mui/material';
import { useAuth0 } from '@auth0/auth0-react';
import { isMobileOnly } from 'react-device-detect';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { PixiApp } from '../../../core/gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../core/transaction/sheetController';
import { electronMaximizeCurrentWindow } from '../../../helpers/electronMaximizeCurrentWindow';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { useLocalFiles } from '../../../hooks/useLocalFiles';
import { colors } from '../../../theme/colors';
import { isElectron } from '../../../utils/isElectron';
import { DataMenu } from './SubMenus/DataMenu';
import { FormatMenu } from './SubMenus/FormatMenu/FormatMenu';
import { NumberFormatMenu } from './SubMenus/NumberFormatMenu';
import { QuadraticMenu } from './SubMenus/QuadraticMenu';
import { ZoomDropdown } from './ZoomDropdown';

interface IProps {
  app: PixiApp;
  sheetController: SheetController;
}

export const TopBar = (props: IProps) => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { localFilename } = useLocalFiles();
  const { user } = useAuth0();

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
        <QuadraticMenu sheetController={props.sheetController} />
        {!isMobileOnly && (
          <>
            <DataMenu></DataMenu>
            <FormatMenu app={props.app} sheet_controller={props.sheetController} />
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
              / {localFilename}
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
            {user !== undefined && (
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
            )}
            <Button
              style={{
                color: colors.darkGray,
                borderColor: colors.darkGray,
                paddingTop: '1px',
                paddingBottom: '1px',
              }}
              variant="outlined"
              size="small"
              onClick={() => {
                setEditorInteractionState({
                  ...editorInteractionState,
                  showCommandPalette: true,
                });
              }}
            >
              Actions <span style={{ marginLeft: '8px', opacity: '.5' }}>{KeyboardSymbols.Command}P</span>
            </Button>
            <Tooltip title="Coming soon" arrow>
              <Button
                style={{
                  color: colors.darkGray,
                  borderColor: colors.darkGray,
                  paddingTop: '1px',
                  paddingBottom: '1px',
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
    </div>
  );
};
