import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';

import { MenubarItem, MenubarShortcut } from '@/shared/shadcn/ui/menubar';

// TODO: (jimniels) implement types based on ayush's PR
export const MenubarItemAction = ({
  action,
  shortcutOverride,
}: {
  action: keyof typeof defaultActionSpec;
  shortcutOverride?: string;
}) => {
  const actionSpec = defaultActionSpec[action];
  if (!actionSpec) {
    throw new Error(`Action ${action} not found in defaultActionSpec`);
  }

  const { label, run } = actionSpec;
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
  const keyboardShortcut = shortcutOverride ? shortcutOverride : keyboardShortcutEnumToDisplay(action);

  // TODO: (jimniels) implement isAvailable
  return (
    <MenubarItem onClick={() => run()}>
      {Icon && <Icon />} {label}
      {keyboardShortcut && <MenubarShortcut>{keyboardShortcut}</MenubarShortcut>}
    </MenubarItem>
  );
};
