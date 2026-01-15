import {
  defaultUserFilesListFilters,
  userFilesListFiltersAtom,
  type UserFilesListType,
} from '@/dashboard/atoms/userFilesListFiltersAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useAtom } from 'jotai';

const fileTypeOptions: { label: string; value: UserFilesListType }[] = [
  { label: 'All', value: null },
  { label: 'Team', value: 'team' },
  { label: 'Private', value: 'private' },
  { label: 'Shared with me', value: 'shared' },
];

export function UserFilesListFileTypeFilter() {
  const [filters, setFilters] = useAtom(userFilesListFiltersAtom);
  const fileTypeValue = filters.fileType === null ? 'all' : filters.fileType;

  return (
    <>
      <div className="hidden gap-0.5 sm:flex">
        {fileTypeOptions.map(({ label, value }) => (
          <Button
            key={label}
            data-testid={`files-list-file-type-${value}`}
            variant={filters.fileType === value ? 'secondary' : 'ghost'}
            className={cn(
              'flex-shrink-0 px-3 shadow-none',
              filters.fileType === value ? '' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => {
              trackEvent('[Files].filterByType', { type: value ?? 'all' });
              setFilters({
                ...defaultUserFilesListFilters,
                fileType: value,
              });
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <Select
        value={fileTypeValue}
        onValueChange={(value) =>
          setFilters({
            ...defaultUserFilesListFilters,
            fileType: value === 'all' ? null : (value as UserFilesListType),
          })
        }
      >
        <SelectTrigger className="w-40 sm:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fileTypeOptions.map(({ label, value }) => (
            <SelectItem key={label} value={value === null ? 'all' : value}>
              <div className="flex items-center">{label}</div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
