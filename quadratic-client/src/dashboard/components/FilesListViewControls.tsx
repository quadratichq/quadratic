import type { FilesListFilters } from '@/dashboard/components/FilesList';
import {
  FileListViewControlsDropdown,
  type ViewPreferences,
} from '@/dashboard/components/FilesListViewControlsDropdown';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { Avatar } from '@/shared/components/Avatar';
import {
  ArrowDropDownIcon,
  CheckBoxEmptyIcon,
  CheckBoxIcon,
  CloseIcon,
  FileIcon,
  FilePrivateIcon,
  FileSharedWithMeIcon,
  GroupIcon,
  Icon,
  SearchIcon,
} from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { ButtonGroup } from '@/shared/shadcn/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import React, { useState } from 'react';

const fileTypeOptions = [
  { label: 'All', value: '', Icon: FileIcon },
  { label: 'Team', value: 'team', Icon: GroupIcon },
  { label: 'Private', value: 'private', Icon: FilePrivateIcon },
  { label: 'Shared with you', value: 'shared', Icon: FileSharedWithMeIcon },
] as const;

export function FilesListViewControls({
  filterValue,
  setFilterValue,
  viewPreferences,
  setViewPreferences,
  filters,
  setFilters,
}: {
  filterValue: string;
  setFilterValue: React.Dispatch<React.SetStateAction<string>>;
  viewPreferences: ViewPreferences;
  setViewPreferences: React.Dispatch<React.SetStateAction<ViewPreferences>>;
  filters: FilesListFilters;
  setFilters: React.Dispatch<React.SetStateAction<FilesListFilters>>;
}) {
  const [showExtraFilters, setShowExtraFilters] = useState(false);
  const {
    activeTeam: { users },
  } = useDashboardRouteLoaderData();
  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className={`flex flex-row items-center justify-between gap-2`}>
        <div className="flex flex-row items-center gap-2">
          <ButtonGroup className="rounded">
            {fileTypeOptions.map(({ label, value, Icon }) => (
              <Button
                variant="outline"
                className={cn('group', filters.fileType === value && 'bg-accent')}
                onClick={() => setFilters({ ...filters, fileType: value })}
              >
                <Icon
                  size="xs"
                  className={cn(
                    'mr-1 text-muted-foreground group-hover:text-foreground',
                    filters.fileType === value && 'text-foreground'
                  )}
                />
                {label}
              </Button>
            ))}
          </ButtonGroup>
          <div className={`max-w relative flex-grow md:max-w-sm`}>
            <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground opacity-30" />
            <Input
              onChange={(e) => setFilterValue(e.target.value)}
              value={filterValue}
              placeholder="Search…"
              className="w-64 pl-8"
            />
            {filterValue && (
              <Button
                variant="ghost"
                size="icon"
                className={`absolute right-0 top-0 text-muted-foreground hover:bg-transparent`}
                onClick={() => setFilterValue('')}
                aria-label="Clear filter"
              >
                <CloseIcon className={`h-4 w-4`} />
              </Button>
            )}
          </div>
          <Button
            variant={'outline'}
            size="icon"
            className={cn(showExtraFilters && 'bg-accent')}
            onClick={() => setShowExtraFilters((prev) => !prev)}
            aria-label="Toggle extra filters"
          >
            <Icon>filter_list</Icon>
          </Button>
        </div>
        <div className={`flex flex-row items-center gap-2`}>
          <FileListViewControlsDropdown viewPreferences={viewPreferences} setViewPreferences={setViewPreferences} />
        </div>
      </div>
      {showExtraFilters && (
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Creator:{' '}
                {filters.fileCreator === null
                  ? 'Any'
                  : users.find((u) => u.email === filters.fileCreator)?.name || filters.fileCreator}{' '}
                <ArrowDropDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup
                value={filters.fileCreator ?? ''}
                onValueChange={(value) => {
                  setFilters({ ...filters, fileCreator: value === '' ? null : value });
                }}
              >
                <DropdownMenuRadioItem value="">Any</DropdownMenuRadioItem>
                <DropdownMenuSeparator className="!block" />
                {users.map((user) => (
                  <DropdownMenuRadioItem key={user.id} value={user.email}>
                    <Avatar src={user.picture} className="mr-2" /> {user.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => setFilters({ ...filters, sharedPublicly: !filters.sharedPublicly })}>
            {filters.sharedPublicly ? <CheckBoxIcon className="mr-1" /> : <CheckBoxEmptyIcon className="mr-1" />}
            Shared publicly
          </Button>
        </div>
      )}
    </div>
  );
}
