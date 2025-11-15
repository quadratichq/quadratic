import type { Action } from '@/app/actions/actions';
import type { ActionArgs } from '@/app/actions/actionsSpec';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { useIsAvailableArgs } from '@/app/ui/hooks/useIsAvailableArgs';
import { MenubarItem, MenubarShortcut } from '@/shared/shadcn/ui/menubar';
import { trackEvent } from '@/shared/utils/analyticsEvents';

export const MenubarItemAction = <T extends Action>({
  id,
  action,
  actionArgs,
  shortcutOverride,
  onClick,
}: {
  id?: string;
  action: T;
  actionArgs: T extends keyof ActionArgs ? ActionArgs[T] : void;
  shortcutOverride?: string;
  onClick?: () => void;
}) => {
  const isAvailableArgs = useIsAvailableArgs();
  const actionSpec = defaultActionSpec[action];

  const label = actionSpec.label();
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
  const keyboardShortcut = shortcutOverride ? shortcutOverride : keyboardShortcutEnumToDisplay(action);
  const isAvailable = 'isAvailable' in actionSpec ? actionSpec.isAvailable : undefined;
  const isDisabled = 'isDisabled' in actionSpec ? actionSpec.isDisabled : undefined;

  if (isAvailable && !isAvailable(isAvailableArgs)) {
    return null;
  }

  return (
    <MenubarItem
      id={id}
      disabled={isDisabled ? isDisabled() : false}
      onClick={() => {
        trackEvent('[FileMenu].selected', { label });
        actionSpec.run(actionArgs);
        onClick?.();
      }}
    >
      {Icon && <Icon />} {label}
      {keyboardShortcut && <MenubarShortcut>{keyboardShortcut}</MenubarShortcut>}
    </MenubarItem>
  );
};
