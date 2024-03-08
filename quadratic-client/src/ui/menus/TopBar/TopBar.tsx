import { SwitchApp } from '@/shadcn/ui/switch';
import { Search } from '@/ui/components/Search';
import { CommandPaletteIcon } from '@/ui/icons/radix';
import { Box, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { useRecoilState } from 'recoil';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { electronMaximizeCurrentWindow } from '../../../helpers/electronMaximizeCurrentWindow';
import { isEmbed } from '../../../helpers/isEmbed';
import { isElectron } from '../../../utils/isElectron';
import { DataMenu } from './SubMenus/DataMenu';
import { FormatMenu } from './SubMenus/FormatMenu/FormatMenu';
import { NumberFormatMenu } from './SubMenus/NumberFormatMenu';
import { QuadraticMenu } from './SubMenus/QuadraticMenu';
import { useGridSettings } from './SubMenus/useGridSettings';
import { TopBarFileMenu } from './TopBarFileMenu';
import { TopBarMenuItem } from './TopBarMenuItem';
import { TopBarShareButton } from './TopBarShareButton';
import { TopBarUsers } from './TopBarUsers';
import { TopBarZoomMenu } from './TopBarZoomMenu';

export const TopBar = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { permissions } = editorInteractionState;
  const { showCellTypeOutlines, setShowCellTypeOutlines } = useGridSettings();
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
        border: theme.palette.divider,
        borderWidth: '0 0 1px 0',
        borderStyle: 'solid',
        height: theme.spacing(6),
        position: 'relative',
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
        className="flex items-stretch lg:basis-1/3"
        style={{
          //@ts-expect-error
          WebkitAppRegion: 'no-drag',
        }}
      >
        <QuadraticMenu />
        {hasPermissionToEditFile(permissions) && isDesktop && (
          <>
            <DataMenu />
            <FormatMenu />
            <NumberFormatMenu />
            <TopBarMenuItem
              title="Command palette"
              noDropdown
              buttonProps={{
                style: { alignSelf: 'stretch' },
                onClick: () => {
                  setEditorInteractionState((prev) => ({ ...prev, showCommandPalette: true }));
                },
              }}
            >
              <CommandPaletteIcon className="h-4 w-4" />
            </TopBarMenuItem>
          </>
        )}
      </div>

      <TopBarFileMenu />

      <div
        className="flex items-center justify-end gap-3 lg:basis-1/3"
        style={{
          // @ts-expect-error
          WebkitAppRegion: 'no-drag',
        }}
      >
        {isDesktop && !isEmbed && (
          <>
            <TopBarUsers />
            <Tooltip title={`${showCellTypeOutlines ? 'Hide' : 'Show'} code cell outlines`} arrow>
              <SwitchApp checked={showCellTypeOutlines} onCheckedChange={setShowCellTypeOutlines} />
            </Tooltip>
            <TopBarShareButton />
          </>
        )}
        <TopBarZoomMenu />
      </div>
      <Search />
    </Box>
  );
};
