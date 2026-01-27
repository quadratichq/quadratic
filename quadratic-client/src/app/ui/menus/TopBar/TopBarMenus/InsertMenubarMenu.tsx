import { Action } from '@/app/actions/actions';
import {
  editorInteractionStateShowCellTypeMenuAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { useFileImport } from '@/app/ui/hooks/useFileImport';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarItemAction';
import { useDataPicker } from '@/shared/components/DataPicker';
import { CodeIcon, DataObjectIcon, InsertChartIcon, StorageIcon } from '@/shared/components/Icons';
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
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const InsertMenubarMenu = () => {
  const setShowCellTypeMenu = useSetRecoilState(editorInteractionStateShowCellTypeMenuAtom);
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const { open: openDataPicker } = useDataPicker();
  const handleFileImport = useFileImport();

  const handleInsertFromDataCenter = async () => {
    if (!teamUuid) return;

    const result = await openDataPicker(teamUuid, {
      title: 'Insert data from Data Center',
      allowedTypes: ['CSV', 'EXCEL', 'PARQUET'],
      allowUpload: true,
      downloadContent: true,
    });

    if (result?.fileContent) {
      // Convert ArrayBuffer to File
      const file = new File([result.fileContent.data], result.fileContent.name, {
        type: result.fileContent.mimeType,
      });

      // Import the file at the current cursor position
      handleFileImport({
        files: [file],
        sheetId: sheets.current,
        insertAt: { x: sheets.sheet.cursor.position.x, y: sheets.sheet.cursor.position.y },
        cursor: sheets.getCursorPosition(),
        teamUuid,
      });
    }
  };

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
            <MenubarItem onClick={handleInsertFromDataCenter}>
              <StorageIcon />
              From Data Center…
            </MenubarItem>
            <MenubarItemAction action={Action.InsertFile} actionArgs={undefined} />

            <MenubarSeparator />
            <MenubarItemAction action={Action.InsertApiRequestJavascript} actionArgs={undefined} />
            <MenubarItemAction action={Action.InsertApiRequestPython} actionArgs={undefined} />
            <MenubarSeparator />
            <MenubarItem onClick={() => setShowCellTypeMenu(true)}>From connection…</MenubarItem>
          </MenubarSubContent>
          <MenubarItemAction action={Action.InsertDataTable} actionArgs={undefined} />
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
