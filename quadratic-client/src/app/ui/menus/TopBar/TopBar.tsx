import { TopBarMenu } from '@/app/ui/menus/TopBar/TopBarMenu';
import { isElectron } from '@/shared/utils/isElectron';
import { useMediaQuery, useTheme } from '@mui/material';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { electronMaximizeCurrentWindow } from '../../../helpers/electronMaximizeCurrentWindow';
import { isEmbed } from '../../../helpers/isEmbed';
import { TopBarFileMenu } from './TopBarFileMenu';
import { TopBarShareButton } from './TopBarShareButton';
import { TopBarUsers } from './TopBarUsers';

export const TopBar = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { permissions } = editorInteractionState;

  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      className="relative flex h-12 w-full flex-shrink-0 select-none justify-between gap-2 border-b border-border bg-background px-2"
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
        className="flex items-center lg:basis-1/3"
        style={{
          //@ts-expect-error
          WebkitAppRegion: 'no-drag',
        }}
      >
        <TopBarMenu />
        {/*
        TODO: (jimniels) delete these components & apply permissions above
        <QuadraticMenu />
        hasPermissionToEditFile(permissions) && isDesktop && (
          <>
            <DataMenu />
            <FormatMenu />
            <NumberFormatMenu />
          </>
        )}*/}
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
          </>
        )}
      </div>
    </div>
  );
};
