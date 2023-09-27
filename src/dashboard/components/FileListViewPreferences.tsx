import { ArrowDropDown, Check } from '@mui/icons-material';
import { Button, Divider, ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem } from '@mui/material';
import { Dispatch, SetStateAction, useState } from 'react';

export type ViewPreferences = {
  sort: Sort;
  order: Order;
  layout: Layout;
};

export enum Sort {
  Updated,
  Created,
  Alphabetical,
}
export enum Layout {
  List,
  Grid,
}
export enum Order {
  Ascending,
  Descending,
}

const sortOptions = [
  { label: 'Last updated', value: Sort.Updated },
  { label: 'Date created', value: Sort.Created },
  { label: 'Alphabetical', value: Sort.Alphabetical },
];
const orderOptions = [
  { label: 'Oldest first', altLabel: 'A-Z', value: Order.Ascending },
  { label: 'Newest first', altLabel: 'Z-A', value: Order.Descending },
];
const layoutOptions = [
  { label: 'List', value: Layout.List },
  { label: 'Grid', value: Layout.Grid },
];

export function FileListViewPreferences({
  viewPreferences,
  setViewPreferences,
}: {
  viewPreferences: ViewPreferences;
  setViewPreferences: Dispatch<SetStateAction<ViewPreferences>>;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const buttonLabel = sortOptions.find((el) => el.value === viewPreferences.sort)?.label;

  return (
    <div>
      <Button
        id="basic-button"
        aria-controls={open ? 'basic-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
        variant="text"
        color="inherit"
        endIcon={<ArrowDropDown color="inherit" fontSize="inherit" />}
      >
        {/* <span style={{ fontWeight: 'normal', marginRight: '4px' }}>Sort: </span> */}
        {buttonLabel}
      </Button>
      <Menu
        transitionDuration={100} // This has to be fast, or react will re-render first
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          dense: true,
          'aria-labelledby': 'basic-button',
        }}
      >
        <ListSubheader sx={{ lineHeight: '2' }}>Sort:</ListSubheader>

        {/* properly style when dense */}
        {sortOptions.map(({ label, value }) => (
          <ListItem
            label={label}
            isActive={viewPreferences.sort === value}
            handleClose={() => {
              setViewPreferences((prev) => ({
                ...prev,
                sort: value,
                order: value === Sort.Alphabetical ? Order.Ascending : Order.Descending,
              }));
              handleClose();
            }}
          />
        ))}

        <Divider />

        <ListSubheader sx={{ lineHeight: '1.5' }}>Order:</ListSubheader>
        {orderOptions.map(({ altLabel, label, value }) => (
          <ListItem
            label={viewPreferences.sort === Sort.Alphabetical ? altLabel : label}
            isActive={viewPreferences.order === value}
            handleClose={() => {
              setViewPreferences((prev) => ({ ...prev, order: value }));
              handleClose();
            }}
          />
        ))}

        <Divider />

        <ListSubheader sx={{ lineHeight: '1.5' }}>Layout:</ListSubheader>
        {layoutOptions.map(({ label, value }) => (
          <ListItem
            label={label}
            isActive={viewPreferences.layout === value}
            handleClose={() => {
              setViewPreferences((prev) => ({ ...prev, layout: value }));
              handleClose();
            }}
          />
        ))}
      </Menu>
    </div>
  );
}

function ListItem({ label, isActive, handleClose }: any /* TODO */) {
  return (
    <MenuItem onClick={handleClose}>
      {isActive ? (
        <>
          <ListItemIcon>
            <Check />
          </ListItemIcon>
          {label}
        </>
      ) : (
        <ListItemText inset>{label}</ListItemText>
      )}
    </MenuItem>
  );
}
