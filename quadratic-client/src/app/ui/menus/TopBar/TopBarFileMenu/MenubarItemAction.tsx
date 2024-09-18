import { Action } from '@/app/actions/actions';
import { ActionArgs } from '@/app/actions/actionsSpec';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { focusGrid } from '@/app/helpers/focusGrid';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { useIsAvailableArgs } from '@/app/ui/hooks/useIsAvailableArgs';
import { MenubarItem, MenubarShortcut } from '@/shared/shadcn/ui/menubar';
import mixpanel from 'mixpanel-browser';

export const MenubarItemAction = <T extends Action>({
  action,
  actionArgs,
  shortcutOverride,
}: {
  action: T;
  actionArgs: T extends keyof ActionArgs ? ActionArgs[T] : void;
  shortcutOverride?: string;
}) => {
  const isAvailableArgs = useIsAvailableArgs();
  const actionSpec = defaultActionSpec[action];

  const { label, run } = actionSpec;
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
  const keyboardShortcut = shortcutOverride ? shortcutOverride : keyboardShortcutEnumToDisplay(action);
  const isAvailable = 'isAvailable' in actionSpec ? actionSpec.isAvailable : undefined;

  if (isAvailable && !isAvailable(isAvailableArgs)) {
    return null;
  }

  return (
    <MenubarItem
      onClick={() => {
        mixpanel.track('[FileMenu].selected', { label });
        run(actionArgs);
        focusGrid();
      }}
    >
      {Icon && <Icon />} {label}
      {keyboardShortcut && <MenubarShortcut>{keyboardShortcut}</MenubarShortcut>}
    </MenubarItem>
  );
};
