import { Box, Typography, IconButton } from '@mui/material';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { QuadraticMenu } from './SubMenus/QuadraticMenu';
import { FormatMenu } from './SubMenus/FormatMenu/FormatMenu';
import { colors } from '../../../theme/colors';
import { isElectron } from '../../../utils/isElectron';
import { DataMenu } from './SubMenus/DataMenu';
import { NumberFormatMenu } from './SubMenus/NumberFormatMenu';
import { ZoomDropdown } from './ZoomDropdown';
import { electronMaximizeCurrentWindow } from '../../../helpers/electronMaximizeCurrentWindow';
import { IS_READONLY_MODE } from '../../../constants/app';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { useLocalFiles } from '../../../hooks/useLocalFiles';
import { SheetController } from '../../../grid/controller/sheetController';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { TooltipHint } from '../../components/TooltipHint';
import { ManageSearch } from '@mui/icons-material';
import { focusGrid } from '../../../helpers/focusGrid';
import { useGridSettings } from './SubMenus/useGridSettings';
import { styled } from '@mui/material/styles';
import Switch from '@mui/material/Switch';

interface IProps {
  app: PixiApp;
  sheetController: SheetController;
}

const CustomSwitch = styled(Switch)(({ theme }) => ({
  padding: '8px',
  '& .MuiSwitch-track': {
    borderRadius: 22 / 2,
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
      backgroundImage: `url('data:image/svg+xml;utf8,<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="white" d="M6.2998 13.5L1.7998 9L6.2998 4.5L7.25605 5.45625L3.7123 9L7.25605 12.5438L6.2998 13.5ZM11.6998 13.5L10.7436 12.5438L14.2873 9L10.7436 5.45625L11.6998 4.5L16.1998 9L11.6998 13.5Z" /></svg>')`,
      left: 11,
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
    borderColor: 'transparent',

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
    opacity: 0.3, // 30% opacity, same as on on the track above
    boxShadow: 'none',
    width: 14,
    height: 14,
    margin: 3,
  },
  '&:hover .MuiSwitch-thumb': {
    opacity: 1,
  },
  '& .Mui-checked .MuiSwitch-thumb': {
    background: '#fff',
    opacity: 1,
  },
}));

export const TopBar = (props: IProps) => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { localFilename } = useLocalFiles();
  const settings = useGridSettings();
  // const { user } = useAuth0();

  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      style={{
        backgroundColor: 'rgba(255, 255, 255)',
        color: colors.darkGray,
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
        }}
      >
        <QuadraticMenu sheetController={props.sheetController} />
        {!IS_READONLY_MODE && (
          <>
            <DataMenu></DataMenu>
            <FormatMenu app={props.app} sheet_controller={props.sheetController} />
            <NumberFormatMenu app={props.app} sheet_controller={props.sheetController}></NumberFormatMenu>
          </>
        )}
      </Box>

      {IS_READONLY_MODE ? (
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
            style={{ whiteSpace: 'nowrap', marginLeft: '1rem' }}
          >
            Read Only
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            userSelect: 'none',
            visibility: { sm: 'hidden', xs: 'hidden', md: 'visible' },
          }}
        >
          <Typography variant="body2" fontFamily={'sans-serif'} color={colors.mediumGray}>
            Local &nbsp;
          </Typography>
          <Typography variant="body2" fontFamily={'sans-serif'} color={colors.darkGray}>
            / {localFilename}
          </Typography>
          {/* <KeyboardArrowDown fontSize="small" style={{ color: colors.darkGray }}></KeyboardArrowDown> */}
        </Box>
      )}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '1rem',
        }}
        style={{
          //@ts-expect-error
          WebkitAppRegion: 'no-drag',
        }}
      >
        {!IS_READONLY_MODE && (
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
              <CustomSwitch
                onClick={() => {
                  settings.setShowCellTypeOutlines(!settings.showCellTypeOutlines);
                  focusGrid();
                }}
                checked={settings.showCellTypeOutlines}
              />
            </TooltipHint>
            <TooltipHint title="Command palette" shortcut={KeyboardSymbols.Command + 'P'}>
              <IconButton
                onClick={() => {
                  setEditorInteractionState({
                    ...editorInteractionState,
                    showCommandPalette: true,
                  });
                  focusGrid();
                }}
              >
                <ManageSearch />
              </IconButton>
            </TooltipHint>
            {/* <Tooltip title="Coming soon" arrow>
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
            </Tooltip> */}
          </>
        )}
        <ZoomDropdown app={props.app} />
      </Box>
    </div>
  );
};
