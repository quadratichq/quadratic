import {
  defaultUserFilesListFilters,
  userFilesListFiltersAtom,
  type UserFilesListType,
} from '@/dashboard/atoms/userFilesListFiltersAtom';
import { FileIcon, FilePrivateIcon, FileSharedWithMeIcon, GroupIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { ButtonGroup } from '@/shared/shadcn/ui/button-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { cn } from '@/shared/shadcn/utils';
import { useAtom } from 'jotai';
import React from 'react';

const fileTypeOptions: { label: string; value: UserFilesListType; Icon: React.ElementType }[] = [
  { label: 'All', value: null, Icon: FileIcon },
  { label: 'Team', value: 'team', Icon: GroupIcon },
  { label: 'Private', value: 'private', Icon: FilePrivateIcon },
  { label: 'Shared with you', value: 'shared', Icon: FileSharedWithMeIcon },
];

export function UserFilesListFileTypeFilter() {
  const [filters, setFilters] = useAtom(userFilesListFiltersAtom);

  const fileTypeValue = filters.fileType === null ? 'all' : filters.fileType;

  return (
    <>
      <ButtonGroup className="hidden rounded sm:flex">
        {fileTypeOptions.map(({ label, value, Icon }) => (
          <Button
            key={label}
            variant="outline"
            className={cn(
              'group flex-shrink-0 hover:text-primary',
              filters.fileType === value && 'bg-accent text-primary'
            )}
            onClick={() =>
              setFilters({
                ...defaultUserFilesListFilters,
                fileType: value,
              })
            }
          >
            <Icon size="xs" className="mr-1" />
            {label}
          </Button>
        ))}
      </ButtonGroup>
      <Select
        value={fileTypeValue}
        onValueChange={(value) =>
          setFilters({
            ...defaultUserFilesListFilters,
            fileType: value === 'all' ? null : (value as UserFilesListType),
          })
        }
      >
        <SelectTrigger className="sm:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fileTypeOptions.map(({ label, value, Icon }) => (
            <SelectItem key={label} value={value === null ? 'all' : value}>
              <div className="flex items-center">
                <Icon size="xs" className="mr-2" />
                {label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
