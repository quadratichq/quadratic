import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { BorderMenu } from '@/app/ui/components/BorderMenu';

import { MenubarItem, MenubarSub, MenubarSubContent, MenubarSubTrigger } from '@/shared/shadcn/ui/menubar';

// TODO: (jimniels) implement types based on ayush's PR
export const MenubarBorderItemAction = ({ action }: { action: Action.FormatBorders }) => {
  const actionSpec = defaultActionSpec[action];
  if (!actionSpec) {
    throw new Error(`Action ${action} not found in defaultActionSpec`);
  }

  const { label } = actionSpec;
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;

  // TODO: (jimniels) implement isAvailable
  return (
    <MenubarSub>
      <MenubarSubTrigger>
        {Icon && <Icon />}
        {label}
      </MenubarSubTrigger>
      <MenubarSubContent>
        <MenubarItem>
          <BorderMenu />
        </MenubarItem>
      </MenubarSubContent>
    </MenubarSub>
  );
};
