import { CommandItem, CommandShortcut } from '@/shadcn/ui/command';
import fuzzysort from 'fuzzysort';

// Props generated in the root CommandPalette and passed to every CommandPaletteListItem
export interface CommandPaletteListItemSharedProps {
  label: string;
  // listItemIndex: number;
  // selectedListItemIndex: number;
  // addKeywords?: string;
  fuzzysortResult?: any; // TODO: type
}

// Contextual props added to each individual <CommandPaletteListItem>
interface CommandPaletteListItemUniqueProps {
  action: () => void;
  disabled?: boolean;
  icon?: any;
  shortcut?: string;
  shortcutModifiers?: Array<string> | string;
  keywords?: Array<string> | string;
}

// All props this component needs
interface CommandPaletteListItemProps extends CommandPaletteListItemSharedProps, CommandPaletteListItemUniqueProps {}

export const CommandPaletteListItem = (props: CommandPaletteListItemProps) => {
  const {
    // selectedListItemIndex,
    // closeCommandPalette,
    // listItemIndex,
    action,
    disabled,
    label,
    shortcut,
    shortcutModifiers,
    icon,
    fuzzysortResult,
    // addKeywords,
  } = props;

  let displayText: (string | JSX.Element)[] | null | string = label;

  // remove any keywords from the displayed search result
  // if (addKeywords && fuzzysortResult?.target) {
  //   fuzzysort.highlight({ ...fuzzysortResult, target: fuzzysortResult.target.replace(addKeywords, '') }, (m, i) => (
  //     <b key={i}>{m}</b>
  //   ));
  // }
  if (fuzzysortResult && fuzzysortResult.target === label) {
    displayText = fuzzysort.highlight(fuzzysortResult, (m, i) => <b key={i}>{m}</b>);
  }

  return (
    <CommandItem
      onSelect={() => {
        action();
        // TODO close command palette
      }}
      disabled={disabled}
    >
      <div className={`mr-2 flex h-5 w-5 items-center opacity-50`}>{icon ? icon : null}</div>
      <div>{displayText}</div>
      {shortcut && (
        <CommandShortcut>
          {shortcutModifiers}
          {shortcut}
        </CommandShortcut>
      )}
    </CommandItem>
  );

  // return (
  //   <ListItem disablePadding key={label}>
  //     <ListItemButton
  //       // FYI: this is used to animate scroll through list items and trigger click on ENTER
  //       data-command-bar-list-item-index={listItemIndex}
  //       disabled={disabled}
  //       onClick={() => {
  //         mixpanel.track('[CommandPalette].run', { label: label });
  //         action();
  //         closeCommandPalette();
  //       }}
  //       selected={listItemIndex === selectedListItemIndex}
  //     >
  //       {icon && <ListItemicon>{icon}</ListItemicon>}
  //       <ListItemText primary={displayText} inset={icon ? false : true} />

  //       {shortcut && (
  //         <ListItemSecondaryAction style={{ fontSize: '14px', opacity: '.5' }}>
  //           {shortcutModifiers ? shortcutModifiers : ''}
  //           {shortcut}
  //         </ListItemSecondaryAction>
  //       )}
  //     </ListItemButton>
  //   </ListItem>
  // );
};
