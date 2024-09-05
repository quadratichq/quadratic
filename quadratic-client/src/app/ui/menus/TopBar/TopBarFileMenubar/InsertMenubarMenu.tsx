import {
  ArrowDropDownCircleIcon,
  CheckBoxIcon,
  CodeIcon,
  DataObjectIcon,
  InsertChartIcon,
  SheetNewIcon,
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
      <MenubarContent>
        <MenubarSub>
          <MenubarSubTrigger>
            <CodeIcon /> Code
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItem>Formula</MenubarItem>
            <MenubarItem>Python</MenubarItem>
            <MenubarItem>JavaScript</MenubarItem>
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
            <MenubarItem>CSV file</MenubarItem>
            <MenubarItem>Excel file</MenubarItem>
            <MenubarItem>Parquet file</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>Python API request</MenubarItem>
            <MenubarItem>JavaScript API request</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>Connection</MenubarItem>
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
          <SheetNewIcon />
          Sheet
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
};
