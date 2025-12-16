import {
  defaultUserFilesListFilters,
  userFilesListFiltersAtom,
  type UserFilesListType,
} from '@/dashboard/atoms/userFilesListFiltersAtom';
import { FileIcon, FilePrivateIcon, FileSharedWithMeIcon, GroupIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { ButtonGroup } from '@/shared/shadcn/ui/button-group';
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

  return (
    <ButtonGroup className="rounded">
      {fileTypeOptions.map(({ label, value, Icon }) => (
        <Button
          key={label}
          variant="outline"
          className={cn('group hover:text-primary', filters.fileType === value && 'bg-accent text-primary')}
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
  );
}
