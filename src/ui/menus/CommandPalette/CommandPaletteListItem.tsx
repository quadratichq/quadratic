import { ListItem, ListItemButton, ListItemIcon, ListItemSecondaryAction, ListItemText } from '@mui/material';
import fuzzysort from 'fuzzysort';
import mixpanel from 'mixpanel-browser';
import { ReactElement } from 'react';
import { SheetController } from '../../../grid/controller/SheetController';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';

// Props generated in the root CommandPalette and passed to every CommandPaletteListItem
export interface CommandPaletteListItemSharedProps {
  closeCommandPalette: Function;
  fuzzysortResult?: Fuzzysort.Result;
  label: string;
  listItemIndex: number;
  selectedListItemIndex: number;

  // NOTE: possible optimiziation here.
  // Props are passed dynamically to subcomponent, e.g. <CommandPaletteListItem {...props}>
  // but these aren’t needed in that component but are in the intermediary one
  // for capturing stateful values when needed.
  sheetController: SheetController;

  // needed by some menu items (eventually should be moved to pixiAppEvents)
  app: PixiApp;
}

// Contextual props added to each individual <CommandPaletteListItem>
interface CommandPaletteListItemUniqueProps {
  action: Function;
  disabled?: boolean;
  icon?: ReactElement;
  shortcut?: string;
  shortcutModifiers?: Array<string>;
}

// All props this component needs
interface CommandPaletteListItemProps extends CommandPaletteListItemSharedProps, CommandPaletteListItemUniqueProps {}

export const CommandPaletteListItem = (props: CommandPaletteListItemProps) => {
  const {
    selectedListItemIndex,
    closeCommandPalette,
    listItemIndex,
    action,
    disabled,
    label,
    shortcut,
    shortcutModifiers,
    icon,
    fuzzysortResult,
  } = props;

  const displayText = fuzzysortResult ? fuzzysort.highlight(fuzzysortResult, (m, i) => <b key={i}>{m}</b>) : label;

  return (
    <ListItem disablePadding key={label}>
      <ListItemButton
        // FYI: this is used to anitmate scroll through list items and trigger click on ENTER
        data-command-bar-list-item-index={listItemIndex}
        disabled={disabled}
        onClick={() => {
          mixpanel.track('[CommandPalette].run', { label: label });
          action();
          closeCommandPalette();
        }}
        selected={listItemIndex === selectedListItemIndex}
      >
        {icon && <ListItemIcon>{icon}</ListItemIcon>}
        <ListItemText primary={displayText} inset={icon ? false : true} />

        {shortcut && (
          <ListItemSecondaryAction style={{ fontSize: '14px', opacity: '.5' }}>
            {shortcutModifiers ? shortcutModifiers : ''}
            {shortcut}
          </ListItemSecondaryAction>
        )}
      </ListItemButton>
    </ListItem>
  );
};
