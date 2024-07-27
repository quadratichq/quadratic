import { Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { useRecoilState } from 'recoil';

import { hasPermissionToEditFile } from '@/app/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { electronMaximizeCurrentWindow } from '@/app/helpers/electronMaximizeCurrentWindow';
import { isEmbed } from '@/app/helpers/isEmbed';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { CommandPaletteIcon } from '@/app/ui/icons';
import { DataMenu } from '@/app/ui/menus/TopBar/SubMenus/DataMenu';
import { FormatMenu } from '@/app/ui/menus/TopBar/SubMenus/FormatMenu/FormatMenu';
import { NumberFormatMenu } from '@/app/ui/menus/TopBar/SubMenus/NumberFormatMenu';
import { QuadraticMenu } from '@/app/ui/menus/TopBar/SubMenus/QuadraticMenu';
import { useGridSettings } from '@/app/ui/menus/TopBar/SubMenus/useGridSettings';
import { TopBarFileMenu } from '@/app/ui/menus/TopBar/TopBarFileMenu';
import { TopBarMenuItem } from '@/app/ui/menus/TopBar/TopBarMenuItem';
import { TopBarShareButton } from '@/app/ui/menus/TopBar/TopBarShareButton';
import { TopBarUsers } from '@/app/ui/menus/TopBar/TopBarUsers';
import { TopBarZoomMenu } from '@/app/ui/menus/TopBar/TopBarZoomMenu';
import { SwitchApp } from '@/shared/shadcn/ui/switch';
import { isElectron } from '@/shared/utils/isElectron';

export const TopBar = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { permissions } = editorInteractionState;
  const { showCellTypeOutlines, setShowCellTypeOutlines } = useGridSettings();

  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      className="relative flex h-12 w-full select-none justify-between gap-2 border-b border-border bg-background"
      style={
        isElectron()
          ? {
              paddingLeft: '4.5rem',
              // this allows the window to be dragged in Electron
              // @ts-expect-error
              WebkitAppRegion: 'drag',
            }
          : {}
      }
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
            <TopBarShareButton />
            <Tooltip title={`${showCellTypeOutlines ? 'Hide' : 'Show'} code cell outlines`} arrow>
              <SwitchApp checked={showCellTypeOutlines} onCheckedChange={setShowCellTypeOutlines} />
            </Tooltip>
          </>
        )}
        <div className="flex self-stretch">
          {isDesktop && (
            <TopBarMenuItem
              title={`Command palette (${KeyboardSymbols.Command + 'P'})`}
              noDropdown
              buttonProps={{
                style: { alignSelf: 'stretch' },
                onClick: () => {
                  setEditorInteractionState((prev) => ({ ...prev, showCommandPalette: true }));
                },
              }}
            >
              <CommandPaletteIcon style={{ fontSize: '22px' }} />
            </TopBarMenuItem>
          )}
          <TopBarZoomMenu />
        </div>
      </div>
    </div>
  );
};
