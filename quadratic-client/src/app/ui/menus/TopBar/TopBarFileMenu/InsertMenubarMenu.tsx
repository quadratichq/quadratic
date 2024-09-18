import { Action } from '@/app/actions/actions';
import { editorInteractionStateShowCellTypeMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarFileMenu/MenubarItemAction';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CodeIcon, DataObjectIcon, InsertChartIcon } from '@/shared/components/Icons';
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
  const setShowCellTypeMenu = useSetRecoilState(editorInteractionStateShowCellTypeMenuAtom);
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
            <MenubarItem onClick={() => addGlobalSnackbar(IMPORT_MESSAGE)}>
              From file (CSV, Excel, or Parquet)
            </MenubarItem>
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

        <MenubarSeparator />

        <MenubarItemAction action={Action.InsertSheet} actionArgs={undefined} />
      </MenubarContent>
    </MenubarMenu>
  );
};
