import { Avatar } from '@/shared/components/Avatar';
import { TYPE } from '@/shared/constants/appConstants';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { GlobeIcon } from '@radix-ui/react-icons';
import { ReactNode } from 'react';
import { Layout, ViewPreferences } from './FilesListViewControlsDropdown';

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
  filterMatch?: 'name' | 'creator';
  filterValue: string;
  setFilterValue?: Function;
  viewPreferences: ViewPreferences;
  creator?: { name?: string; picture?: string };
  hasNetworkError?: boolean;
  isShared?: boolean;
  actions?: ReactNode;
}) {
  const __html = filterMatch === 'name' ? highlightMatchingString(name, filterValue) : name;
  const isGrid = viewPreferences.layout === Layout.Grid;

  return (
    <div className={`flex w-full items-center gap-1`}>
      <div className={`flex flex-1 items-center justify-between gap-1 overflow-hidden`}>
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
                setFilterValue(creator.name);
              }}
              className={cn(
                'relative mr-[2px]',
                filterMatch === 'creator' &&
                  "after:absolute after:left-0 after:top-0 after:h-full after:w-full after:rounded-full  after:outline after:outline-4 after:outline-yellow-200 after:content-['']"
              )}
            >
              <Avatar alt={creator.name} src={creator.picture}>
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
    return `<b class="bg-yellow-100">${match}</b>`;
  });
  return highlightedString;
}
