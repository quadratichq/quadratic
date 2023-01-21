import { ListItem, ListItemButton, ListItemText, ListItemSecondaryAction, ListItemIcon } from '@mui/material';
import fuzzysort from 'fuzzysort';
import { ReactElement } from 'react';

// Added dynamically to every CommandPaletteListItem by components higher in the tree
export interface CommandPaletteListItemDynamicProps {
  label: string;
  listItemIndex: number;
  action: Function;
  selectedListItemIndex: number;
  closeCommandPalette: Function;
  fuzzysortResult?: Fuzzysort.Result;
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

export const CommandPaletteListItem = (props: CommandPaletteListItemProps) => {
  const {
    selectedListItemIndex,
    // closeCommandPalette,
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
    <ListItem disablePadding key={label} data-command-bar-list-item-index={listItemIndex}>
      <ListItemButton
        selected={listItemIndex === selectedListItemIndex}
        disabled={disabled}
        onClick={() => {
          console.log('Fire action: ', label);
          action();
          // closeCommandPalette();
        }}
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
