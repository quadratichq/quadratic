import { ListItem, ListItemButton, ListItemText, ListItemSecondaryAction, ListItemIcon } from '@mui/material';
import fuzzysort from 'fuzzysort';
import { ReactElement } from 'react';
import { PixiApp } from '../../../core/gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../core/transaction/sheetController';

// Added dynamically to every CommandPaletteListItem by components higher in the tree
export interface CommandPaletteListItemDynamicProps {
  action: Function;
  closeCommandPalette: Function;
  fuzzysortResult?: Fuzzysort.Result;
  label: string;
  listItemIndex: number;
  selectedListItemIndex: number;
}

// Added statically in the individual file of each CommandPaletteListItem
export interface CommandPaletteListItemStaticProps {
  disabled?: boolean;
  icon?: ReactElement;
  shortcut?: string;
  shortcutModifiers?: Array<string>;
}

// All props this component needs
interface CommandPaletteListItemProps extends CommandPaletteListItemDynamicProps, CommandPaletteListItemStaticProps {}

// Composable middle component gets app and sheet which it doesn't pass to CommandPaletteListItemProps
export interface ComposableCommandPaletteListItemProps extends CommandPaletteListItemProps {
  app: PixiApp;
  sheetController: SheetController;
}

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

  // If there's no active search value, don't run `fuzzysort.highlight`.
  // It will crash.
  const displayText = fuzzysortResult ? fuzzysort.highlight(fuzzysortResult, (m, i) => <b key={i}>{m}</b>) : label;

  return (
    <ListItem disablePadding key={label}>
      <ListItemButton
        // FYI: this is used to anitmate scroll through list items and trigger click on ENTER
        data-command-bar-list-item-index={listItemIndex}
        disabled={disabled}
        onClick={() => {
          console.log('Fire action: ', label);
          action();
          closeCommandPalette();
        }}
        selected={listItemIndex === selectedListItemIndex}
      >
        {icon ? (
          <>
            <ListItemIcon>{icon}</ListItemIcon>
            <ListItemText primary={displayText} />
          </>
        ) : (
          <ListItemText primary={displayText} inset={!icon} />
        )}
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
