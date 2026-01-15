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
  description,
  creator,
  hasNetworkError,
  isShared,
  viewPreferences,
  actions,
  children,
}: {
  name: string;
  nameFilter: string;
  description: string;
  viewPreferences: ViewPreferences;
  creator?: FileCreator;
  hasNetworkError?: boolean;
  isShared?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const __html = nameFilter ? highlightMatchingString(name, nameFilter) : name;
  const isGrid = viewPreferences.layout === Layout.Grid;

  return (
    <div className={`flex w-full items-center`}>
      <div className={`flex w-full items-center justify-between gap-3`}>
        <div className={cn(`flex-1 overflow-hidden`, isGrid ? 'flex-col' : 'flex-col gap-0.5')}>
          <h2
            className={cn(isGrid ? 'truncate text-sm' : 'text-md flex-1 leading-tight')}
            dangerouslySetInnerHTML={{ __html }}
          />

          <div className="flex h-5 items-center gap-1">
            {children}
            {hasNetworkError ? (
              <p className={`${TYPE.caption} !text-destructive`}>Failed to sync changes</p>
            ) : (
              <p className={`${TYPE.caption} flex flex-nowrap items-center gap-1`}>{description}</p>
            )}
          </div>
        </div>

        {creator?.name && creator?.email && (
          <TooltipPopover label={`Created by ${creator.name}`}>
            <Avatar alt={creator.name} src={creator.picture}>
              {creator.name?.[0] ? creator.name?.[0] : creator.email?.[0]}
            </Avatar>
          </TooltipPopover>
        )}
      </div>

      {actions && <div className="flex-none">{actions}</div>}
    </div>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightMatchingString(str: string, search: string) {
  // Escape HTML to prevent XSS
  const escapedStr = escapeHtml(str);
  const escapedSearch = escapeHtml(search);

  // Escape all regex special characters in the search term
  const searchWithEscapedRegex = escapedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(searchWithEscapedRegex, 'gi');

  const highlightedString = escapedStr.replace(regex, (match: string) => {
    return `<b class="bg-yellow-100 dark:bg-yellow-700">${match}</b>`;
  });
  return highlightedString;
}
