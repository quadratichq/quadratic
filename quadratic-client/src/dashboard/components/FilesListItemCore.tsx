import type { FilesListUserFile } from '@/dashboard/components/FilesList';
import { Layout, type ViewPreferences } from '@/dashboard/components/FilesListViewControlsDropdown';
import { Avatar } from '@/shared/components/Avatar';
import { TYPE } from '@/shared/constants/appConstants';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { GlobeIcon } from '@radix-ui/react-icons';
import type { ReactNode } from 'react';

export function FilesListItemCore({
  name,
  description,
  filterMatch,
  filterValue,
  setFilterValue,
  creator,
  hasNetworkError,
  isShared,
  viewPreferences,
  actions,
}: {
  name: string;
  description: string;
  filterMatch?: FilesListUserFile['filterMatch'];
  filterValue: string;
  setFilterValue?: Function;
  viewPreferences: ViewPreferences;
  creator?: FilesListUserFile['creator'];
  hasNetworkError?: boolean;
  isShared?: boolean;
  actions?: ReactNode;
}) {
  const __html = filterMatch === 'file-name' ? highlightMatchingString(name, filterValue) : name;
  const isGrid = viewPreferences.layout === Layout.Grid;

  return (
    <div className={`flex w-full items-center`}>
      <div className={`flex w-full items-center justify-between gap-3`}>
        <div className={cn(`flex-1 overflow-hidden`, isGrid ? 'flex-col' : 'flex-col gap-0.5')}>
          <h2
            className={cn(isGrid ? 'truncate text-sm' : 'text-md flex-1 leading-tight')}
            dangerouslySetInnerHTML={{ __html }}
          />

          {hasNetworkError ? (
            <p className={`${TYPE.caption} !text-destructive`}>Failed to sync changes</p>
          ) : (
            <p className={`${TYPE.caption}`}>
              {isShared && (
                <span className={`after:mr-1 after:pl-1 after:content-['·']`}>
                  <GlobeIcon className="relative -top-[1px] inline h-3 w-3" /> Public
                </span>
              )}
              {description}
            </p>
          )}
        </div>
        {creator && creator.name && setFilterValue && (
          <TooltipPopover label={`Created by ${creator.name}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Toggle filtering by the creator's email based on the current filter match
                setFilterValue(filterMatch && filterValue === creator.email ? '' : creator.email);
              }}
              className={cn(
                'relative',
                (filterMatch === 'creator-email' || filterMatch === 'creator-name') &&
                  "after:absolute after:left-0 after:top-0 after:h-full after:w-full after:rounded-full after:outline after:outline-4 after:outline-yellow-200 after:content-[''] dark:after:outline-yellow-700"
              )}
            >
              <Avatar alt={creator.name} src={import.meta.env.DEV ? '' : creator.picture}>
                {creator.name[0]}
              </Avatar>
            </button>
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
    return `<b class="bg-yellow-100 dark:bg-yellow-700">${match}</b>`;
  });
  return highlightedString;
}
