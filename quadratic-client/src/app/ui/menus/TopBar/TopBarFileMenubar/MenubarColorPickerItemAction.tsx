import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { focusGrid } from '@/app/helpers/focusGrid';
import { QColorPicker } from '@/app/ui/components/qColorPicker';

import { MenubarItem, MenubarSub, MenubarSubContent, MenubarSubTrigger } from '@/shared/shadcn/ui/menubar';

// TODO: (jimniels) implement types based on ayush's PR
export const MenubarColorPickerItemAction = ({ action }: { action: keyof typeof defaultActionSpec }) => {
  const actionSpec = defaultActionSpec[action];
  if (!actionSpec) {
    throw new Error(`Action ${action} not found in defaultActionSpec`);
  }

  const { run, label } = actionSpec;
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
          <QColorPicker
            onChangeComplete={(color) => {
              run(color);
              focusGrid();
            }}
            onClear={() => {
              run(undefined);
              focusGrid();
            }}
          />
        </MenubarItem>
      </MenubarSubContent>
    </MenubarSub>
  );
};
