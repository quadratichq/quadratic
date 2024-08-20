import { TYPE } from '@/shared/constants/appConstants';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/shadcn/ui/avatar';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { GlobeIcon } from '@radix-ui/react-icons';
import { ReactNode } from 'react';
import { Layout, ViewPreferences } from './FilesListViewControlsDropdown';

export function FilesListItemCore({
  name,
  description,
  filterValue,
  creator,
  hasNetworkError,
  isShared,
  viewPreferences,
  actions,
}: {
  name: string;
  description: string;
  filterValue: string;
  viewPreferences: ViewPreferences;
  creator?: { name?: string; picture?: string };
  hasNetworkError?: boolean;
  isShared?: boolean;
  actions?: ReactNode;
}) {
  const __html = filterValue ? highlightMatchingString(name, filterValue) : name;
  const isGrid = viewPreferences.layout === Layout.Grid;

  return (
    <div className={`flex w-full items-center gap-1`}>
      <div className={`flex flex-1 items-center justify-between overflow-hidden`}>
        <div className={cn(`flex-1 overflow-hidden`, isGrid ? 'flex-col' : 'flex-col gap-0.5')}>
          <h2
            className={cn(isGrid ? 'truncate text-sm' : 'text-md flex-1 leading-tight')}
            dangerouslySetInnerHTML={{ __html }}
          />

          {hasNetworkError ? (
            <p className={`${TYPE.caption} !text-destructive`}>Failed to sync changes</p>
          ) : (
            <p className={`flex items-center ${TYPE.caption} mr-1 truncate`}>
              {isShared && (
                <span className={`after:mr-1 after:pl-1 after:content-['·']`}>
                  <GlobeIcon className="relative -top-[1px] inline h-3 w-3" /> Public
                </span>
              )}
              <span className="truncate">{description}</span>
            </p>
          )}
        </div>
        {creator && creator.name && (
          <TooltipPopover label={`Created by ${creator.name}`}>
            <Avatar className="h-6 w-6 text-muted-foreground">
              <AvatarImage src={creator?.picture} alt={creator.name} />
              <AvatarFallback>
                {creator.name[0]}
                {creator.picture}
              </AvatarFallback>
            </Avatar>
          </TooltipPopover>
        )}
      </div>

      {actions && <div className="flex-none">{actions}</div>}
    </div>
  );
}

function highlightMatchingString(str: string, search: string) {
  const searchWithEscapedParenthesis = search.replace('(', '\\(').replace(')', '\\)');
  const regex = new RegExp(searchWithEscapedParenthesis, 'gi'); // case insensitive matching
  const highlightedString = str.replace(regex, (match: string) => {
    return `<b class="bg-yellow-100">${match}</b>`;
  });
  return highlightedString;
}
