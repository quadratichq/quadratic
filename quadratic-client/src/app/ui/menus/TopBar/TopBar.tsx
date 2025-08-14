import { aiViewAtom } from '@/app/atoms/gridSettingsAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { isEmbed } from '@/app/helpers/isEmbed';
import { TopBarFileNameAndLocationMenu } from '@/app/ui/menus/TopBar/TopBarFileNameAndLocationMenu';
import { TopBarMenus } from '@/app/ui/menus/TopBar/TopBarMenus/TopBarMenus';
import { TopBarShareButton } from '@/app/ui/menus/TopBar/TopBarShareButton';
import { TopBarUsers } from '@/app/ui/menus/TopBar/TopBarUsers';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { VERSION } from '@/shared/constants/appConstants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Label } from '@/shared/shadcn/ui/label';
import { Switch } from '@/shared/shadcn/ui/switch';
import { useRecoilState } from 'recoil';

export const TopBar = () => {
  // TODO: what about embeddable view? should we show the file menu?

  const [aiView, setAIView] = useRecoilState(aiViewAtom);

  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      className="relative flex h-12 w-full flex-shrink-0 select-none justify-between gap-2 border-b border-border bg-background pl-2 pr-4"
    >
      <div
        className="flex items-center lg:basis-1/3"
        style={{
          //@ts-expect-error
          WebkitAppRegion: 'no-drag',
        }}
      >
        {!isEmbed && (
          <>
            <div className="hidden lg:block">
              <TopBarMenus />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-0 self-stretch px-2 md:hidden">
                <QuadraticLogo />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                  focusGrid();
                }}
              >
                <DropdownMenuItem
                  onClick={() => {
                    window.location.href = '/';
                  }}
                >
                  Back to dashboard
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>Quadratic {VERSION}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      <TopBarFileNameAndLocationMenu />

      <div
        className="flex items-center justify-end gap-3 lg:basis-1/3"
        style={{
          // @ts-expect-error
          WebkitAppRegion: 'no-drag',
        }}
      >
        <Switch id="ai-view" checked={aiView} onCheckedChange={setAIView} />
        <Label htmlFor="ai-view">AI View</Label>
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
