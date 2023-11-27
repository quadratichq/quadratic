import { Button } from '@/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shadcn/ui/dropdown-menu';
import { cn } from '@/shadcn/utils';
import { ChevronDownIcon, DashboardIcon, DropdownMenuIcon, ListBulletIcon } from '@radix-ui/react-icons';
import { Dispatch, SetStateAction } from 'react';

export type ViewPreferences = {
  sort: Sort;
  order: Order;
  layout: Layout;
};
export enum Sort {
  Updated = '1',
  Created = '2',
  Alphabetical = '3',
}
export enum Layout {
  List = '1',
  Grid = '2',
}
export enum Order {
  Ascending = '1',
  Descending = '2',
}

const sortLabelsByValue = {
  [Sort.Updated]: 'Last updated',
  [Sort.Created]: 'Date created',
  [Sort.Alphabetical]: 'Alphabetical',
};
const layoutOptionsByValue = {
  [Layout.List]: 'List',
  [Layout.Grid]: 'Grid',
};

export function FileListViewControlsDropdown({
  viewPreferences,
  setViewPreferences,
}: {
  viewPreferences: ViewPreferences;
  setViewPreferences: Dispatch<SetStateAction<ViewPreferences>>;
}) {
  const orderOptionsByValue = {
    [Order.Ascending]: viewPreferences.sort === Sort.Alphabetical ? 'A-Z' : 'Oldest first',
    [Order.Descending]: viewPreferences.sort === Sort.Alphabetical ? 'Z-A' : 'Newest first',
  };

  const sortButtonLabel = sortLabelsByValue[viewPreferences.sort];

  const sortOptionsMenu = (
    <DropdownMenuRadioGroup
      value={viewPreferences.sort}
      onValueChange={(val) => {
        const value = val as Sort;
        setViewPreferences((prev) => ({
          ...prev,
          sort: value,
          order: value === Sort.Alphabetical ? Order.Ascending : Order.Descending,
        }));
      }}
    >
      {Object.entries(sortLabelsByValue).map(([value, label]) => (
        <DropdownMenuRadioItem key={label} value={String(value)}>
          {label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );

  const orderOptionsMenu = (
    <DropdownMenuRadioGroup
      value={viewPreferences.order}
      onValueChange={(val) => {
        const value = val as Order;
        setViewPreferences((prev) => ({ ...prev, order: value }));
      }}
    >
      {Object.entries(orderOptionsByValue).map(([value, label]) => (
        <DropdownMenuRadioItem key={label} value={String(value)}>
          {label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );

  const layoutOptionsMenu = (
    <DropdownMenuRadioGroup
      value={viewPreferences.layout}
      onValueChange={(val) => {
        const value = val as Layout;
        setViewPreferences((prev) => ({ ...prev, layout: value }));
      }}
    >
      {Object.entries(layoutOptionsByValue).map(([value, label]) => (
        <DropdownMenuRadioItem key={label} value={String(value)}>
          {label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );

  return (
    <>
      <div className="hidden sm:flex sm:flex-row sm:items-center sm:gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              {sortButtonLabel} <ChevronDownIcon className="ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            <DropdownMenuLabel>Sort</DropdownMenuLabel>
            {sortOptionsMenu}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Order</DropdownMenuLabel>
            {orderOptionsMenu}
          </DropdownMenuContent>
        </DropdownMenu>

        <div>
          <Button
            className={cn(viewPreferences.layout === Layout.Grid && 'bg-accent', `!opacity-100`)}
            variant="ghost"
            size="icon"
            disabled={viewPreferences.layout === Layout.Grid}
            onClick={() => setViewPreferences((prev: any) => ({ ...prev, layout: Layout.Grid }))}
          >
            <DashboardIcon />
          </Button>
          <Button
            className={cn(viewPreferences.layout === Layout.List && 'bg-accent', `!opacity-100`)}
            variant="ghost"
            size="icon"
            disabled={viewPreferences.layout === Layout.List}
            onClick={() => setViewPreferences((prev: any) => ({ ...prev, layout: Layout.List }))}
          >
            <ListBulletIcon />
          </Button>
        </div>
      </div>
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <DropdownMenuIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Sort</DropdownMenuLabel>
            {sortOptionsMenu}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Order</DropdownMenuLabel>
            {orderOptionsMenu}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Layout</DropdownMenuLabel>
            {layoutOptionsMenu}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
