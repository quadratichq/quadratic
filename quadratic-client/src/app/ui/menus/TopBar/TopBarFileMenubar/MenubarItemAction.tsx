import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { useRootRouteLoaderData } from '@/routes/_root';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';

import { MenubarItem, MenubarShortcut } from '@/shared/shadcn/ui/menubar';

// TODO: (jimniels) implement types based on ayush's PR
export const MenubarItemAction = ({ action, shortcutOverride }: { action: Action; shortcutOverride?: string }) => {
  const actionSpec = defaultActionSpec[action];
  if (!actionSpec) {
    throw new Error(`Action ${action} not found in defaultActionSpec`);
  }

  // Get args for doing permissions
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    userMakingRequest: { fileTeamPrivacy, teamPermissions, filePermissions },
  } = useFileRouteLoaderData();
  const isAvailableArgs = { filePermissions, fileTeamPrivacy, isAuthenticated, teamPermissions };

  const { label, run } = actionSpec;
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
  const labelVerbose = 'labelVerbose' in actionSpec ? actionSpec.labelVerbose : label;
  const keyboardShortcut = shortcutOverride ? shortcutOverride : keyboardShortcutEnumToDisplay(action);
  const isAvailable = 'isAvailable' in actionSpec ? actionSpec.isAvailable : undefined;

  if (isAvailable && !isAvailable(isAvailableArgs)) {
    return null;
  }

  // TODO: (jimniels) implement isAvailable
  return (
    <MenubarItem onClick={() => run()}>
      {Icon && <Icon />} {labelVerbose}
      {keyboardShortcut && <MenubarShortcut>{keyboardShortcut}</MenubarShortcut>}
    </MenubarItem>
  );
};
