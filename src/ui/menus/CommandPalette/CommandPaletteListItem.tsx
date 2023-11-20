import { CommandItem, CommandShortcut } from '@/shadcn/ui/command';

// Props generated in the root CommandPalette and passed to every CommandPaletteListItem
export interface CommandPaletteListItemSharedProps {
  label: string;
}

// Contextual props added to each individual <CommandPaletteListItem>
interface CommandPaletteListItemUniqueProps {
  action: () => void;
  disabled?: boolean;
  Icon?: any;
  shortcut?: string;
  shortcutModifiers?: Array<string>;
}

// All props this component needs
interface CommandPaletteListItemProps extends CommandPaletteListItemSharedProps, CommandPaletteListItemUniqueProps {}

export const CommandPaletteListItem = (props: CommandPaletteListItemProps) => {
  const { action, disabled, label, shortcut, shortcutModifiers, Icon } = props;

  return (
    <CommandItem
      onSelect={() => {
        action();
        // TODO close command palette
      }}
      disabled={disabled}
    >
      <div className={`mr-2 flex h-5 w-5 items-center text-primary`}>{Icon ? Icon : null}</div>
      {label}
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
  //       {icon && <ListItemIcon>{icon}</ListItemIcon>}
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
