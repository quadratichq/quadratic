import { Layout, type ViewPreferences } from '@/dashboard/components/FilesListViewControlsDropdown';
import { Separator } from '@/shared/shadcn/ui/separator';
import { cn } from '@/shared/shadcn/utils';

export function FilesListItems({
  children,
  viewPreferences,
}: {
  children: React.ReactNode;
  viewPreferences: ViewPreferences;
}) {
  return (
    <ul
      className={cn(
        viewPreferences.layout === Layout.Grid && 'grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] gap-4'
      )}
    >
      {children}
    </ul>
  );
}

export function ListItem({ children }: { children: React.ReactNode }) {
  return <li className="relative flex">{children}</li>;
}

export function ListItemView({
  viewPreferences,
  thumbnail,
  lazyLoad,
  children,
  overlay,
}: {
  viewPreferences: ViewPreferences;
  thumbnail: string | null;
  lazyLoad: boolean;
  children: React.ReactNode;
  overlay?: React.ReactNode;
}) {
  const { layout } = viewPreferences;

  return layout === Layout.Grid ? (
    <div className="border border-border p-2 hover:bg-accent">
      <div className="relative flex aspect-video items-center justify-center bg-background">
        {thumbnail ? (
          <img
            loading={lazyLoad ? 'lazy' : 'eager'}
            src={thumbnail}
            crossOrigin="anonymous"
            alt="File thumbnail screenshot"
            className="dark-mode-hack object-cover"
            draggable="false"
          />
        ) : (
          <div className="flex items-center justify-center">
            <img
              src={'/favicon.ico'}
              alt="File thumbnail placeholder"
              className={`opacity-10 brightness-0 grayscale`}
              width="24"
              height="24"
              draggable="false"
            />
          </div>
        )}
        {overlay && <div className="absolute left-1 top-1">{overlay}</div>}
      </div>
      <Separator className="border-accent" />
      <div className="pt-2">{children}</div>
    </div>
  ) : (
    <div className={`flex w-full flex-row items-center gap-4 py-2 hover:bg-accent lg:px-2`}>
      <div className={`relative hidden border border-border shadow-sm md:block`}>
        {thumbnail ? (
          <img
            loading={lazyLoad ? 'lazy' : 'eager'}
            src={thumbnail}
            crossOrigin="anonymous"
            alt="File thumbnail screenshot"
            className={`aspect-video object-fill`}
            width="80"
            draggable="false"
          />
        ) : (
          <div className="flex aspect-video w-20 items-center justify-center bg-background">
            <img
              src={'/favicon.ico'}
              alt="File thumbnail placeholder"
              className={`h-4 w-4 opacity-10 brightness-0 grayscale`}
              width="16"
              height="16"
              draggable="false"
            />
          </div>
        )}
        {overlay && <div className="absolute left-0.5 top-0.5">{overlay}</div>}
      </div>
      <div className="flex-grow">{children}</div>
    </div>
  );
}
