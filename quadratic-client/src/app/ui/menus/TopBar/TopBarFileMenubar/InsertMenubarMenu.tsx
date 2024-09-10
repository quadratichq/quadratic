import { Action } from '@/app/actions/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarFileMenubar/MenubarItemAction';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import {
  ArrowDropDownCircleIcon,
  CheckBoxIcon,
  CodeIcon,
  DataObjectIcon,
  InsertChartIcon,
} from '@/shared/components/Icons';
import { IMPORT_MESSAGE } from '@/shared/constants/appConstants';
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
  const { addGlobalSnackbar } = useGlobalSnackbar();
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
            <MenubarItem onClick={() => addGlobalSnackbar(IMPORT_MESSAGE)}>
              From file (CSV, Excel, or Parquet)
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItemAction action={Action.InsertApiRequestJavascript} />
            <MenubarItemAction action={Action.InsertApiRequestPython} />
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
