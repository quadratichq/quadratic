import { aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { AddIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

type AIAnalystSelectContextMenuProps = {
  context: Context;
  setContext: React.Dispatch<React.SetStateAction<Context>>;
  disabled: boolean;
  onClose: () => void;
};

export function AIAnalystSelectContextMenu({
  context,
  setContext,
  disabled,
  onClose,
}: AIAnalystSelectContextMenuProps) {
  const loading = useRecoilValue(aiAnalystLoadingAtom);
  const [sheetNames, setSheetNames] = useState<string[]>([]);

  useEffect(() => {
    const updateSheets = () => {
      setSheetNames(sheets.getSheetListItems().map((sheet) => sheet.name));
    };
    updateSheets();

    events.on('addSheet', updateSheets);
    events.on('deleteSheet', updateSheets);
    events.on('sheetInfoUpdate', updateSheets);
    return () => {
      events.off('addSheet', updateSheets);
      events.off('deleteSheet', updateSheets);
      events.off('sheetInfoUpdate', updateSheets);
    };
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled || loading}>
        <Button size="icon-sm" className="h-5 w-5 shadow-none" variant="outline">
          <AddIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        alignOffset={-4}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        {sheetNames.map((sheetName) => (
          <DropdownMenuCheckboxItem
            key={sheetName}
            checked={context.currentSheet === sheetName || context.sheets.includes(sheetName)}
            onCheckedChange={() =>
              setContext((prev) => {
                const isCurrentSheet = sheets.sheet.name === sheetName;
                const currentSheet = !isCurrentSheet ? prev.currentSheet : prev.currentSheet ? '' : sheetName;
                const nextSheets = isCurrentSheet
                  ? prev.sheets
                  : prev.sheets.includes(sheetName)
                  ? prev.sheets.filter((prevSheet) => prevSheet !== sheetName)
                  : [...prev.sheets, sheetName];
                return {
                  ...prev,
                  sheets: nextSheets,
                  currentSheet,
                };
              })
            }
          >
            <span>{sheetName}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
