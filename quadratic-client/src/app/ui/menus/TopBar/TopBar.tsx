import TopBarFileMenu from '@/app/ui/menus/TopBar/TopBarFileMenu';
import { isElectron } from '@/shared/utils/isElectron';
import { electronMaximizeCurrentWindow } from '../../../helpers/electronMaximizeCurrentWindow';
import { isEmbed } from '../../../helpers/isEmbed';
import { TopBarFileNameAndLocationMenu } from './TopBarFileNameAndLocationMenu';
import { TopBarShareButton } from './TopBarShareButton';
import { TopBarUsers } from './TopBarUsers';

export const TopBar = () => {
  // TODO: what about embedable view? should we show the file menu?
  // TODO: (jimniels) delete these components & apply permissions above

  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      className="relative flex h-12 w-full flex-shrink-0 select-none justify-between gap-2 border-b border-border bg-background pl-2 pr-4"
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
        <TopBarFileMenu />
      </div>

      <TopBarFileNameAndLocationMenu />

      <div
        className="flex items-center justify-end gap-3 lg:basis-1/3"
        style={{
          // @ts-expect-error
          WebkitAppRegion: 'no-drag',
        }}
      >
        {!isEmbed && (
          <>
            <TopBarUsers />
            <TopBarShareButton />
          </>
        )}
      </div>
    </div>
  );
};
