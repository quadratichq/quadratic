import {
  defaultUserFilesListFilters,
  hasFiltersAppliedAtom,
  userFilesListFiltersAtom,
} from '@/dashboard/atoms/userFilesListFiltersAtom';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { Avatar } from '@/shared/components/Avatar';
import { FiltersIcon } from '@/shared/components/Icons';
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
import { useAtom, useAtomValue } from 'jotai';
import { useState } from 'react';

export function UserFilesListOtherFilters() {
  const {
    activeTeam: { users },
  } = useDashboardRouteLoaderData();
  const [showDropdown, setShowDropdown] = useState(false);

  const [filters, setFilters] = useAtom(userFilesListFiltersAtom);
  const hasFilters = useAtomValue(hasFiltersAppliedAtom);

  return (
    <DropdownMenu open={showDropdown} onOpenChange={setShowDropdown}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative flex-shrink-0', hasFilters && '!bg-foreground !text-background')}
          aria-label="Other filters"
          onClick={() => setShowDropdown(true)}
        >
          <FiltersIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-[300px] w-56 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          Filters
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 py-0 font-normal"
            disabled={!hasFilters}
            onClick={(e) => {
              e.preventDefault();
              setFilters(defaultUserFilesListFilters);
              setShowDropdown(false);
            }}
          >
            Clear
          </Button>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem
          checked={filters.hasScheduledTasks}
          onCheckedChange={(checked) => {
            setFilters({ ...filters, hasScheduledTasks: checked });
          }}
        >
          Scheduled tasks
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={filters.sharedPublicly}
          onCheckedChange={(checked) => {
            setFilters({ ...filters, sharedPublicly: checked });
          }}
        >
          Shared publicly
        </DropdownMenuCheckboxItem>

        {users.length > 1 && filters.fileType !== 'shared' && filters.fileType !== 'private' && (
          <>
            <DropdownMenuSeparator className="!block" />
            <DropdownMenuLabel className="hidden text-xs text-muted-foreground">Created by</DropdownMenuLabel>

            {users.map((user) => (
              <DropdownMenuCheckboxItem
                key={user.id}
                checked={filters.fileCreatorEmails.includes(user.email)}
                onCheckedChange={(checked) => {
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
