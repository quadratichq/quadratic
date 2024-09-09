import { Action } from '@/app/actions/actions';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarFileMenubar/MenubarItemAction';
import {
  ArrowDropDownCircleIcon,
  CheckBoxIcon,
  CodeIcon,
  DataObjectIcon,
  InsertChartIcon,
  SheetIcon,
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

export const InsertMenubarMenu = () => {
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
            <MenubarItem>Python (Plotly)</MenubarItem>
            <MenubarItem>JavaScript (Chart.js))</MenubarItem>
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <DataObjectIcon />
            Data
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItem>From CSV file</MenubarItem>
            <MenubarItem>From Excel file</MenubarItem>
            <MenubarItem>From Parquet file</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>From Python API request</MenubarItem>
            <MenubarItem>From JavaScript API request</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>From connection…</MenubarItem>
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
        <MenubarItem>
          <SheetIcon />
          Sheet
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
};
