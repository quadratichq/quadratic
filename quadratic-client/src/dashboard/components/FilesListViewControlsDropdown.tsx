import { ArrowDropDownIcon, MoreHorizIcon, ViewGridIcon, ViewListIcon } from '@/shared/components/Icons';
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
import type { Dispatch, SetStateAction } from 'react';

export type ViewPreferences = {
  layout: Layout;
  order?: Order;
  sort?: Sort;
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
  [Sort.Updated]: 'Last modified',
  [Sort.Created]: 'Date created',
  [Sort.Alphabetical]: 'Alphabetical',
};
const layoutOptionsByValue = {
  [Layout.List]: 'List',
  [Layout.Grid]: 'Grid',
};

export function FilesListViewToggle({
  viewPreferences,
  setViewPreferences,
  className,
}: {
  viewPreferences: ViewPreferences;
  setViewPreferences: Dispatch<SetStateAction<ViewPreferences>>;
  className?: string;
}) {
  const orderOptionsByValue = {
    [Order.Ascending]: viewPreferences.sort === Sort.Alphabetical ? 'A-Z' : 'Oldest first',
    [Order.Descending]: viewPreferences.sort === Sort.Alphabetical ? 'Z-A' : 'Newest first',
  };

  const sortButtonLabel = viewPreferences.sort ? sortLabelsByValue[viewPreferences.sort] : '';

  const sortOptionsMenu = viewPreferences.sort ? (
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
  ) : null;

  const orderOptionsMenu = viewPreferences.order ? (
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
  ) : null;

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
      <div className={cn(`hidden xl:flex xl:flex-shrink-0 xl:flex-row xl:items-center xl:gap-1`, className)}>
        {(viewPreferences.sort || viewPreferences.order) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                {sortButtonLabel} <ArrowDropDownIcon className="ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52">
              {viewPreferences.sort && (
                <>
                  <DropdownMenuLabel>Sort</DropdownMenuLabel>
                  {sortOptionsMenu}
                </>
              )}
              {viewPreferences.sort && viewPreferences.order && <DropdownMenuSeparator />}
              {viewPreferences.order && (
                <>
                  <DropdownMenuLabel>Order</DropdownMenuLabel>
                  {orderOptionsMenu}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="flex flex-shrink-0 items-center text-muted-foreground">
          <Button
            className={cn(viewPreferences.layout === Layout.Grid && 'bg-accent', `!opacity-100`)}
            variant="ghost"
            size="icon"
            disabled={viewPreferences.layout === Layout.Grid}
            onClick={() => setViewPreferences((prev: any) => ({ ...prev, layout: Layout.Grid }))}
          >
            <ViewGridIcon />
          </Button>
          <Button
            className={cn(viewPreferences.layout === Layout.List && 'bg-accent', `!opacity-100`)}
            variant="ghost"
            size="icon"
            disabled={viewPreferences.layout === Layout.List}
            onClick={() => setViewPreferences((prev: any) => ({ ...prev, layout: Layout.List }))}
          >
            <ViewListIcon />
          </Button>
        </div>
      </div>

      <div className={cn(`xl:hidden`, className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            {viewPreferences.sort && (
              <>
                <DropdownMenuLabel>Sort</DropdownMenuLabel>
                {sortOptionsMenu}
                <DropdownMenuSeparator />
              </>
            )}
            {viewPreferences.sort && (
              <>
                <DropdownMenuLabel>Order</DropdownMenuLabel>
                {orderOptionsMenu}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel>Layout</DropdownMenuLabel>
            {layoutOptionsMenu}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
