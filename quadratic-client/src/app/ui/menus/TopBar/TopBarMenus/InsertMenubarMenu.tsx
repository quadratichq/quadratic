import { Action } from '@/app/actions/actions';
import { editorInteractionStateShowCellTypeMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarItemAction';
import { CodeIcon, DataObjectIcon, InsertChartIcon } from '@/shared/components/Icons';
import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@/shared/shadcn/ui/menubar';
import { useSetRecoilState } from 'recoil';

export const InsertMenubarMenu = () => {
  const setShowCellTypeMenu = useSetRecoilState(editorInteractionStateShowCellTypeMenuAtom);

  return (
    <MenubarMenu>
      <MenubarTrigger>Insert</MenubarTrigger>
      <MenubarContent className="pointer-move-ignore">
        <MenubarSub>
          <MenubarSubTrigger>
            <CodeIcon /> Code
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.InsertCodePython} actionArgs={undefined} />
            <MenubarItemAction action={Action.InsertCodeJavascript} actionArgs={undefined} />
            <MenubarItemAction action={Action.InsertCodeFormula} actionArgs={undefined} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <InsertChartIcon />
            Chart
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.InsertChartPython} actionArgs={undefined} />
            <MenubarItemAction action={Action.InsertChartJavascript} actionArgs={undefined} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <DataObjectIcon />
            Data
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.InsertFile} actionArgs={undefined} />

            <MenubarSeparator />
            <MenubarItemAction action={Action.InsertApiRequestJavascript} actionArgs={undefined} />
            <MenubarItemAction action={Action.InsertApiRequestPython} actionArgs={undefined} />
            <MenubarSeparator />
            <MenubarItem onClick={() => setShowCellTypeMenu(true)}>From connection…</MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        <MenubarSeparator />

        <MenubarItemAction action={Action.InsertCheckbox} actionArgs={undefined} />
        <MenubarItemAction action={Action.InsertDropdown} actionArgs={undefined} />
        <MenubarItemAction action={Action.InsertHyperlink} actionArgs={undefined} />
        <MenubarItemAction action={Action.ToggleDataValidation} actionArgs={undefined} />
        <MenubarItemAction action={Action.InsertScheduledTask} actionArgs={undefined} />

        <MenubarSeparator />

        <MenubarItemAction action={Action.InsertSheet} actionArgs={undefined} />
      </MenubarContent>
    </MenubarMenu>
  );
};
