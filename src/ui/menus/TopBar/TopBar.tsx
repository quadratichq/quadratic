import { useContext, useEffect, useRef, useState } from 'react';
import { Box, Typography, IconButton, InputBase } from '@mui/material';
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
import { LocalFilesContext } from '../../QuadraticUIContext';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../grid/controller/sheetController';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { TooltipHint } from '../../components/TooltipHint';
import { ManageSearch } from '@mui/icons-material';
import { focusGrid } from '../../../helpers/focusGrid';
import { useGridSettings } from './SubMenus/useGridSettings';
import CodeOutlinesSwitch from './CodeOutlinesSwitch';

interface IProps {
  app: PixiApp;
  sheetController: SheetController;
}

export const TopBar = (props: IProps) => {
  const { app, sheetController } = props;
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { currentFilename, renameCurrentFile } = useContext(LocalFilesContext);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);

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
        <QuadraticMenu app={app} sheetController={sheetController} />
        {!IS_READONLY_MODE && (
          <>
            <DataMenu></DataMenu>
            <FormatMenu app={app} sheet_controller={sheetController} />
            <NumberFormatMenu app={app} sheet_controller={sheetController}></NumberFormatMenu>
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
            Read only
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexGrow: '1',
            visibility: { sm: 'hidden', xs: 'hidden', md: 'visible' },
          }}
        >
          {isRenaming ? (
            <FileRename
              setIsRenaming={setIsRenaming}
              currentFilename={currentFilename}
              renameCurrentFile={renameCurrentFile}
            />
          ) : (
            <>
              <Typography variant="body2" fontFamily={'sans-serif'} color={colors.mediumGray}>
                Local /&nbsp;
              </Typography>
              <Typography
                onClick={() => {
                  setIsRenaming(true);
                }}
                variant="body2"
                fontFamily={'sans-serif'}
                color={colors.darkGray}
                style={{
                  display: 'block',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  // this is a little bit of a magic number for now, but it
                  // works and truncates at an appropriate, proportional size
                  maxWidth: '25vw',
                }}
              >
                {currentFilename}
              </Typography>
            </>
          )}

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
              <CodeOutlinesSwitch
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
        <ZoomDropdown app={app} />
      </Box>
    </div>
  );
};

function FileRename({
  currentFilename,
  renameCurrentFile,
  setIsRenaming,
}: {
  currentFilename: string;
  renameCurrentFile: Function;
  setIsRenaming: Function;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // When user selects input, highlight it's contents
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.setSelectionRange(0, inputRef.current.value.length);
    }
  }, []);

  return (
    <InputBase
      onKeyUp={(e) => {
        if (e.key === 'Enter') {
          inputRef.current?.blur();
          focusGrid();
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
        setIsRenaming(false);
        const value = inputRef.current?.value;

        // Don't allow empty file names
        if (value === '' || (value && value.trim() === '')) {
          return;
        }

        // Don't do anything if the name didn't change
        if (value === currentFilename) {
          return;
        }

        renameCurrentFile(value);
      }}
      defaultValue={currentFilename}
      inputRef={inputRef}
      autoFocus
      inputProps={{ style: { textAlign: 'center' } }}
      sx={{ fontSize: '.875rem', color: colors.darkGray, width: '100%' }}
    />
  );
}
