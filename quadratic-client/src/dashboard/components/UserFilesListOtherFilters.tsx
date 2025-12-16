import { userFilesListFiltersAtom } from '@/dashboard/atoms/userFilesListFiltersAtom';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { Avatar } from '@/shared/components/Avatar';
import { FiltersIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { cn } from '@/shared/shadcn/utils';
import { useAtom } from 'jotai';
import { useState } from 'react';

export function UserFilesListOtherFilters() {
  const {
    activeTeam: { users },
  } = useDashboardRouteLoaderData();
  const [showDropdown, setShowDropdown] = useState(false);
  const [filters, setFilters] = useAtom(userFilesListFiltersAtom);

  const hasOtherFilters = filters.fileCreator || filters.sharedPublicly;

  return (
    <DropdownMenu open={showDropdown} onOpenChange={setShowDropdown}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn('relative flex-shrink-0', hasOtherFilters && 'bg-accent text-primary hover:text-primary')}
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
            className="h-6 px-2 py-0 font-normal"
            disabled={!hasOtherFilters}
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
            const currentValue = filters.sharedPublicly ? 'sharedPublicly' : (filters.fileCreator ?? '');

            // If clicking the already-selected filter, reset all filters
            if (value === currentValue && value !== '') {
              setFilters({ ...filters, fileCreator: null, sharedPublicly: false });
            } else if (value === '') {
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
          {users.length > 1 && filters.fileType !== 'shared' && filters.fileType !== 'private' && (
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
  );
}
