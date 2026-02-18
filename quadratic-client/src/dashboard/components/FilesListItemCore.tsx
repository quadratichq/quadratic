import { Layout, type ViewPreferences } from '@/dashboard/components/FilesListViewControlsDropdown';
import type { FileCreator } from '@/dashboard/components/UserFilesList';
import { Avatar } from '@/shared/components/Avatar';
import { TYPE } from '@/shared/constants/appConstants';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import type { ReactNode } from 'react';

export function FilesListItemCore({
  name,
  nameFilter,
  folderPath,
  description,
  creator,
  hasNetworkError,
  viewPreferences,
  actions,
  children,
  onCreatorClick,
}: {
  name: string;
  nameFilter: string;
  /** Optional path shown before the name in a lighter color (e.g. "Subfolder/") */
  folderPath?: string;
  description: string;
  viewPreferences: ViewPreferences;
  creator?: FileCreator;
  hasNetworkError?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
  onCreatorClick?: (creator: FileCreator) => void;
}) {
  const isGrid = viewPreferences.layout === Layout.Grid;
  const displayName = nameFilter ? highlightMatchingString(name, nameFilter) : name;
  const fullTitle = folderPath ? `${folderPath}/${name}` : name;

  const titleClasses = cn(
    'flex min-w-0 items-baseline overflow-hidden leading-tight',
    isGrid ? 'text-sm' : 'text-md flex-1'
  );

  return (
    <div className={`flex w-full items-center`}>
      <div className={`flex w-full items-center justify-between gap-3`}>
        <div className={cn(`flex-1 overflow-hidden`, isGrid ? 'flex-col' : 'flex-col gap-0.5')} data-file-title-area>
          <h2 className={titleClasses} title={fullTitle}>
            {folderPath ? (
              <>
                <span className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground/60">
                  {folderPath}
                </span>
                <span className="shrink-0 text-muted-foreground/60">/</span>
                <span className="shrink-0">{displayName}</span>
              </>
            ) : (
              <span className="block min-w-0 truncate">{displayName}</span>
            )}
          </h2>

          <div className="flex min-h-5 items-center gap-1">
            {children}
            {hasNetworkError ? (
              <p className={`${TYPE.caption} !text-destructive`}>Failed to sync changes</p>
            ) : (
              <p className={`${TYPE.caption} flex flex-nowrap items-center gap-1`}>{description}</p>
            )}
          </div>
        </div>

        {creator?.email && onCreatorClick && (
          <TooltipPopover label={`Created by ${creator.name || creator.email}`}>
            <button
              className="rounded-full hover:ring-1 hover:ring-primary hover:ring-offset-2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCreatorClick(creator);
              }}
            >
              <Avatar alt={creator.name || creator.email} src={creator.picture}>
                {creator.name?.[0] || creator.email[0]}
              </Avatar>
            </button>
          </TooltipPopover>
        )}
      </div>

      {actions && <div className="flex-none">{actions}</div>}
    </div>
  );
}

function highlightMatchingString(str: string, search: string): ReactNode {
  if (!search) return str;

  const escaped = search.replace('(', '\\(').replace(')', '\\)');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = str.split(regex);

  return parts.map((part, i) =>
    part.toLowerCase() === search.toLowerCase() ? (
      <b key={i} className="bg-yellow-100 dark:bg-yellow-700">
        {part}
      </b>
    ) : (
      part
    )
  );
}
