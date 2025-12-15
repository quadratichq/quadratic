import { defaultFilesListFilters, filesListFiltersAtom } from '@/dashboard/atoms/filesListFiltersAtom';
import {
  FileListViewControlsDropdown,
  type ViewPreferences,
} from '@/dashboard/components/FilesListViewControlsDropdown';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { Avatar } from '@/shared/components/Avatar';
import {
  CloseIcon,
  FileIcon,
  FilePrivateIcon,
  FileSharedWithMeIcon,
  FiltersIcon,
  GroupIcon,
  SearchIcon,
} from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { ButtonGroup } from '@/shared/shadcn/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { useAtom } from 'jotai';
import React, { useMemo, useState } from 'react';

const fileTypeOptions = [
  { label: 'All', value: '', Icon: FileIcon },
  { label: 'Team', value: 'team', Icon: GroupIcon },
  { label: 'Private', value: 'private', Icon: FilePrivateIcon },
  { label: 'Shared with you', value: 'shared', Icon: FileSharedWithMeIcon },
] as const;

export function FilesListViewControls({
  viewPreferences,
  setViewPreferences,
}: {
  viewPreferences: ViewPreferences;
  setViewPreferences: React.Dispatch<React.SetStateAction<ViewPreferences>>;
}) {
  const {
    activeTeam: { users },
  } = useDashboardRouteLoaderData();
  const [showDropdown, setShowDropdown] = useState(false);

  const [filters, setFilters] = useAtom(filesListFiltersAtom);

  const activeFiltersCount = useMemo(() => {
    return filters.fileCreator ? 1 : 0 + (filters.sharedPublicly ? 1 : 0);
  }, [filters]);
  return (
    <div className={`mb-4 flex flex-row items-center justify-between gap-2`}>
      <div className="flex flex-row items-center gap-2">
        <ButtonGroup className="rounded">
          {fileTypeOptions.map(({ label, value, Icon }) => (
            <Button
              variant="outline"
              className={cn('group hover:text-primary', filters.fileType === value && 'bg-accent text-primary')}
              onClick={() =>
                setFilters((prev) => ({
                  ...defaultFilesListFilters,
                  fileType: value,
                }))
              }
            >
              <Icon
                size="xs"
                className={cn(
                  'mr-1',
                  filters.fileType === value ? '' : 'ztext-muted-foreground zgroup-hover:text-foreground'
                )}
              />
              {label}
            </Button>
          ))}
        </ButtonGroup>
        <div className={`max-w relative flex-grow md:max-w-sm`}>
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground opacity-30" />
          <Input
            onChange={(e) => setFilters((prev) => ({ ...prev, fileName: e.target.value }))}
            value={filters.fileName}
            placeholder="Search…"
            className="w-64 pl-8"
          />
          {filters.fileName && (
            <Button
              variant="ghost"
              size="icon"
              className={`absolute right-0 top-0 text-muted-foreground hover:bg-transparent`}
              onClick={() => setFilters((prev) => ({ ...prev, fileName: '' }))}
              aria-label="Clear filter"
            >
              <CloseIcon className={`h-4 w-4`} />
            </Button>
          )}
        </div>

        <DropdownMenu open={showDropdown} onOpenChange={setShowDropdown}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn('relative', activeFiltersCount > 0 && 'bg-accent text-primary hover:text-primary')}
              aria-label="Other filters"
              onClick={() => setShowDropdown(true)}
            >
              <FiltersIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-[300px] w-56 overflow-y-auto">
            <DropdownMenuLabel className="flex items-center justify-between">
              Other filters{' '}
              <Button
                size="sm"
                variant="ghost"
                className={'h-6 px-2 py-0 font-normal'}
                disabled={activeFiltersCount === 0}
                onClick={(e) => {
                  e.preventDefault();
                  setFilters({ ...filters, fileCreator: null, sharedPublicly: false });
                  setShowDropdown(false);
                }}
              >
                Clear
              </Button>
            </DropdownMenuLabel>

            <DropdownMenuRadioGroup
              value={filters.sharedPublicly ? 'sharedPublicly' : (filters.fileCreator ?? '')}
              onValueChange={(value) => {
                if (value === '') {
                  setFilters({ ...filters, fileCreator: null, sharedPublicly: false });
                } else if (value === 'sharedPublicly') {
                  setFilters({ ...filters, fileCreator: null, sharedPublicly: true });
                } else {
                  setFilters({ ...filters, fileCreator: value, sharedPublicly: false });
                }
                setShowDropdown(false);
              }}
            >
              <DropdownMenuSeparator className="!block" />
              <DropdownMenuRadioItem value="sharedPublicly">Shared publicly</DropdownMenuRadioItem>
              {users.length > 0 && filters.fileType !== 'shared' && filters.fileType !== 'private' && (
                <>
                  <DropdownMenuSeparator className="!block" />
                  {users.map((user) => (
                    <DropdownMenuRadioItem key={user.id} value={user.email}>
                      <Avatar src={user.picture} className="mr-2" /> {user.name}
                    </DropdownMenuRadioItem>
                  ))}
                </>
              )}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className={`flex flex-row items-center gap-2`}>
        <FileListViewControlsDropdown viewPreferences={viewPreferences} setViewPreferences={setViewPreferences} />
      </div>
    </div>
  );
}
