import type { FilesListFilters } from '@/dashboard/components/FilesList';
import {
  FileListViewControlsDropdown,
  type ViewPreferences,
} from '@/dashboard/components/FilesListViewControlsDropdown';
import { ArrowDropDownIcon, CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Input } from '@/shared/shadcn/ui/input';
import React from 'react';

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
  return (
    <div className={`flex flex-row items-center justify-between gap-2 pb-4`}>
      <div className="flex flex-row items-center gap-2">
        <div className={`max-w relative flex-grow md:max-w-sm`}>
          <Input
            onChange={(e) => setFilterValue(e.target.value)}
            value={filterValue}
            placeholder="File name…"
            className="w-64"
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Type: {filters.fileType === '' ? 'All' : filters.fileType} <ArrowDropDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup
              value={filters.fileType}
              onValueChange={(value) => setFilters({ ...filters, fileType: value as 'team' | 'private' | 'shared' })}
            >
              <DropdownMenuRadioItem value="">All</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="team">Team</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="private">Private</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="shared">Shared with you</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Creator: Any <ArrowDropDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={true}>Any</DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={false}>Jim Nielsen</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={false}>Jane Doe</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className={`flex flex-row items-center gap-2`}>
        <FileListViewControlsDropdown viewPreferences={viewPreferences} setViewPreferences={setViewPreferences} />
      </div>
    </div>
  );
}
