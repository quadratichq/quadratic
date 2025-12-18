import {
  defaultUserFilesListFilters,
  userFilesListFiltersAtom,
  type UserFilesListType,
} from '@/dashboard/atoms/userFilesListFiltersAtom';
import {
  ArrowDropDownIcon,
  FileIcon,
  FilePrivateIcon,
  FileSharedWithMeIcon,
  GroupIcon,
} from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { ButtonGroup } from '@/shared/shadcn/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { cn } from '@/shared/shadcn/utils';
import { useAtom } from 'jotai';
import React from 'react';

const fileTypeOptions: { label: string; value: UserFilesListType; Icon: React.ElementType }[] = [
  { label: 'All', value: null, Icon: FileIcon },
  { label: 'Team', value: 'team', Icon: GroupIcon },
  { label: 'Private', value: 'private', Icon: FilePrivateIcon },
  { label: 'Shared with me', value: 'shared', Icon: FileSharedWithMeIcon },
];

export function UserFilesListFileTypeFilter() {
  const [filters, setFilters] = useAtom(userFilesListFiltersAtom);

  const fileTypeValue = filters.fileType === null ? 'all' : filters.fileType;
  const fileTypeLabel =
    fileTypeOptions.find((option) => option.value === fileTypeValue)?.label ?? fileTypeOptions[0].label;

  return (
    <>
      <ButtonGroup className="hidden rounded sm:flex">
        {fileTypeOptions.map(({ label, value, Icon }) => (
          <Button
            key={label}
            variant="outline"
            className={cn('flex-shrink-0 px-3', filters.fileType === value && '!bg-foreground !text-background')}
            onClick={() =>
              setFilters({
                ...defaultUserFilesListFilters,
                fileType: value,
              })
            }
          >
            {label}
          </Button>
        ))}
      </ButtonGroup>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="hidden">
            {fileTypeLabel} <ArrowDropDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup
            value={fileTypeValue}
            onValueChange={(value) =>
              setFilters({
                ...defaultUserFilesListFilters,
                fileType: value === 'all' ? null : (value as UserFilesListType),
              })
            }
          >
            {fileTypeOptions.map(({ label, value, Icon }) => (
              <DropdownMenuRadioItem
                key={label}
                value={value === null ? 'all' : value}
                className="justify-between gap-4"
              >
                {label} {value !== null && <Icon className="ml-auto !hidden text-muted-foreground opacity-50" />}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

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
