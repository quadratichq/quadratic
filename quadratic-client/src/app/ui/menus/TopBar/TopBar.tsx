import { isEmbed } from '@/app/helpers/isEmbed';
import { TopBarMenus } from '@/app/ui/menus/TopBar/TopBarMenus/TopBarMenus';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { VERSION } from '@/shared/constants/appConstants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { isElectron } from '@/shared/utils/isElectron';
import { electronMaximizeCurrentWindow } from '../../../helpers/electronMaximizeCurrentWindow';
import { TopBarFileNameAndLocationMenu } from './TopBarFileNameAndLocationMenu';
import { TopBarShareButton } from './TopBarShareButton';
import { TopBarUsers } from './TopBarUsers';

export const TopBar = () => {
  // TODO: what about embedable view? should we show the file menu?

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
        {!isEmbed && (
          <div className="hidden lg:block">
            <TopBarMenus />
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-0 self-stretch px-2 md:hidden">
            <QuadraticLogo />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {
                window.location.href = '/';
              }}
            >
              Back to dashboard
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>{VERSION}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
            <div className="hidden md:block">
              <TopBarShareButton />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
