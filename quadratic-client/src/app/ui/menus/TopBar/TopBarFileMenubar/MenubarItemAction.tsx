import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';

import { MenubarItem, MenubarShortcut } from '@/shared/shadcn/ui/menubar';

// TODO: (jimniels) implement types based on ayush's PR
export const MenuItemAction = ({ action, shortcutOverride }: { action: Action; shortcutOverride?: string }) => {
  const actionSpec = defaultActionSpec[action];
  if (!actionSpec) {
    throw new Error(`Action ${action} not found in defaultActionSpec`);
  }

  const { Icon, label, run } = actionSpec;
  const keyboardShortcut = shortcutOverride ? shortcutOverride : keyboardShortcutEnumToDisplay(action);

  // TODO: (jimniels) implement isAvailable
  return (
    <MenubarItem onClick={() => run()}>
      {Icon && <Icon />} {label}
      {keyboardShortcut && <MenubarShortcut>{keyboardShortcut}</MenubarShortcut>}
    </MenubarItem>
  );
};
