import { Action } from '@/app/actions/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarFileMenubar/MenubarItemAction';
import {
  ArrowDropDownCircleIcon,
  CheckBoxIcon,
  CodeIcon,
  DataObjectIcon,
  InsertChartIcon,
} from '@/shared/components/Icons';
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
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  return (
    <MenubarMenu>
      <MenubarTrigger>Insert</MenubarTrigger>
      <MenubarContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <MenubarSub>
          <MenubarSubTrigger>
            <CodeIcon /> Code
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.InsertCodePython} />
            <MenubarItemAction action={Action.InsertCodeJavascript} />
            <MenubarItemAction action={Action.InsertCodeFormula} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <InsertChartIcon />
            Chart
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.InsertChartPython} />
            <MenubarItemAction action={Action.InsertChartJavascript} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <DataObjectIcon />
            Data
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItem>From file (CSV, Excel, or Parquet)</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>From Python API request</MenubarItem>
            <MenubarItem>From JavaScript API request</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => setEditorInteractionState((prev) => ({ ...prev, showCellTypeMenu: true }))}>
              From connection…
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        <MenubarSeparator />
        <MenubarItem>
          <CheckBoxIcon /> Checkbox
        </MenubarItem>
        <MenubarItem>
          <ArrowDropDownCircleIcon />
          Dropdown
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItemAction action={Action.InsertSheet} />
      </MenubarContent>
    </MenubarMenu>
  );
};
