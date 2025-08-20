import type { GenericAction } from '@/app/actions';
import type { Action } from '@/app/actions/actions';
import { CommandItem, CommandShortcut } from '@/shared/shadcn/ui/command';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { JSX } from 'react';

export type CommandGroup = {
  heading: string;
  commands: Array<Command | Action>;
};

export type Command = {
  label: string;
  Component: (props: CommandPaletteListItemDynamicProps) => JSX.Element;
  keywords?: Array<string>;
  isAvailable?: GenericAction['isAvailable'];
};

// Props passed to every <CommandPaletteListItem> when it's created/rendered
export interface CommandPaletteListItemDynamicProps {
  label: string;
  closeCommandPalette: () => void;
  openDateFormat: () => void;
  fuzzysortResult: Fuzzysort.Result | null;
  value: string;
}

// Props declared on every individual <CommandPaletteListItem>
interface CommandPaletteListItemStaticProps {
  action: () => void;
  disabled?: boolean;
  icon?: any;
  shortcut?: string;
  shortcutModifiers?: Array<string> | string;
}

// All props this component needs
interface CommandPaletteListItemProps extends CommandPaletteListItemDynamicProps, CommandPaletteListItemStaticProps {}

export const CommandPaletteListItem = (props: CommandPaletteListItemProps) => {
  const { closeCommandPalette, action, disabled, label, shortcut, shortcutModifiers, icon, fuzzysortResult, value } =
    props;

  let displayText: string | (string | JSX.Element)[] | null = label;
  // Highlight the text, but only if it's an exact match on the original label
  if (fuzzysortResult && fuzzysortResult.target === label) {
    displayText = fuzzysortResult.highlight((m, i) => <b key={i}>{m}</b>);
  }

  return (
    <CommandItem
      value={value}
      onSelect={() => {
        trackEvent('[CommandPalette].run', { label });
        closeCommandPalette();
        action();
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      disabled={disabled}
    >
      <div className={`mr-2 flex h-5 w-5 items-center text-muted-foreground`}>{icon ? icon : null}</div>
      <div>{displayText}</div>
      {shortcut && (
        <CommandShortcut>
          {shortcutModifiers}
          {shortcut}
        </CommandShortcut>
      )}
    </CommandItem>
  );
};
