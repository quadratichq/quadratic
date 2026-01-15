import {
  defaultUserFilesListFilters,
  hasFiltersAppliedAtom,
  userFilesListFiltersAtom,
} from '@/dashboard/atoms/userFilesListFiltersAtom';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { Avatar } from '@/shared/components/Avatar';
import { CloseIcon, FiltersIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useAtom, useAtomValue } from 'jotai';
import { useState } from 'react';

export function UserFilesListFiltersDropdown() {
  const {
    activeTeam: { users },
  } = useDashboardRouteLoaderData();
  const [showDropdown, setShowDropdown] = useState(false);

  const [filters, setFilters] = useAtom(userFilesListFiltersAtom);
  const hasFilters = useAtomValue(hasFiltersAppliedAtom);

  if (filters.fileType === 'shared') {
    return null;
  }

  return (
    <DropdownMenu open={showDropdown} onOpenChange={setShowDropdown}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={'user-select-none relative flex-shrink-0 text-muted-foreground hover:text-foreground'}
          aria-label="Filters"
          onClick={() => setShowDropdown(true)}
        >
          <FiltersIcon />
          {hasFilters && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-[300px] w-56 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          Filters
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className={cn('h-6 px-2 py-0 font-normal text-muted-foreground', !hasFilters && 'invisible opacity-0')}
              disabled={!hasFilters}
              onClick={(e) => {
                e.preventDefault();
                setFilters((prev) => ({
                  ...defaultUserFilesListFilters,
                  fileType: prev.fileType,
                  fileName: prev.fileName,
                }));
              }}
            >
              Clear
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={'h-6 w-6 py-0 font-normal'}
              aria-label="Close"
              onClick={(e) => {
                setShowDropdown(false);
              }}
            >
              <CloseIcon className="text-muted-foreground" />
            </Button>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem
          checked={filters.hasScheduledTasks}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={(checked) => {
            trackEvent('[Files].filterByScheduledTasks');
            setFilters({ ...filters, hasScheduledTasks: checked });
          }}
        >
          Scheduled tasks
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={filters.sharedPublicly}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={(checked) => {
            trackEvent('[Files].filterBySharedPublicly');
            setFilters({ ...filters, sharedPublicly: checked });
          }}
        >
          Shared publicly
        </DropdownMenuCheckboxItem>

        {users.length > 1 && (filters.fileType === 'team' || filters.fileType === null) && (
          <>
            <DropdownMenuSeparator className="!block" />
            <DropdownMenuLabel className="hidden text-xs text-muted-foreground">Created by</DropdownMenuLabel>

            {users.map((user) => (
              <DropdownMenuCheckboxItem
                key={user.id}
                checked={filters.fileCreatorEmails.includes(user.email)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) => {
                  trackEvent('[Files].filterByFileCreator');
                  setFilters({
                    ...filters,
                    fileCreatorEmails: checked
                      ? [...filters.fileCreatorEmails, user.email]
                      : filters.fileCreatorEmails.filter((email) => email !== user.email),
                  });
                }}
              >
                <Avatar src={user.picture} className="mr-2" /> {user.name}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
