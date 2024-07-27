import { GlobeIcon } from '@radix-ui/react-icons';
import type { ReactNode } from 'react';

import type { ViewPreferences } from '@/dashboard/components/FilesListViewControlsDropdown';
import { Layout } from '@/dashboard/components/FilesListViewControlsDropdown';
import { TYPE } from '@/shared/constants/appConstants';
import { cn } from '@/shared/shadcn/utils';

export function FilesListItemCore({
  name,
  description,
  filterValue,
  hasNetworkError,
  isShared,
  viewPreferences,
  actions,
}: {
  name: string;
  description: string;
  filterValue: string;
  viewPreferences: ViewPreferences;
  hasNetworkError?: boolean;
  isShared?: boolean;
  actions?: ReactNode;
}) {
  const __html = filterValue ? highlightMatchingString(name, filterValue) : name;
  const isGrid = viewPreferences.layout === Layout.Grid;

  return (
    <div className={`flex flex-row items-center gap-2`}>
      <div className={cn(`relative mr-auto flex min-w-0 flex-grow-[2]`, isGrid ? 'flex-col' : 'flex-col gap-0.5')}>
        <h2
          className={cn(isGrid ? 'truncate text-sm' : 'text-md flex-1 leading-tight')}
          dangerouslySetInnerHTML={{ __html }}
        />

        {hasNetworkError ? (
          <p className={`${TYPE.caption} !text-destructive`}>Failed to sync changes</p>
        ) : (
          <ul className={`flex items-center ${TYPE.caption}`}>
            {isShared && (
              <li className={`after:mr-1 after:pl-1 after:content-['·']`}>
                <GlobeIcon className="relative -top-[1px] inline h-3 w-3" /> Public
              </li>
            )}
            <li>{description}</li>
          </ul>
        )}
      </div>
      {actions}
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
