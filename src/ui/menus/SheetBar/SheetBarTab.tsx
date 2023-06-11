import './SheetBarTab.css';

import { MouseEvent, PointerEvent, useCallback, useEffect, useState } from 'react';
import { Sheet } from '../../../grid/sheet/Sheet';
import { useLocalFiles } from '../../contexts/LocalFiles';
import { SheetController } from '../../../grid/controller/sheetController';
import { focusGrid } from '../../../helpers/focusGrid';

interface Props {
  sheet: Sheet;
  sheetController: SheetController;
  active: boolean;
  onPointerDown: (options: { event: PointerEvent<HTMLDivElement>; sheet: Sheet }) => void;
  onContextMenu: (event: MouseEvent, sheet: Sheet) => void;
  forceRename: boolean;
  clearRename: () => void;
}

export const SheetBarTab = (props: Props): JSX.Element => {
  const { sheet, sheetController, active, onPointerDown, onContextMenu, forceRename, clearRename } = props;

  const localFiles = useLocalFiles();
  const [isRenaming, setIsRenaming] = useState(false);
  useEffect(() => {
    if (forceRename) {
      setIsRenaming(true);
    }
  }, [forceRename]);

  const inputRef = useCallback(
    (node: HTMLInputElement) => {
      if (node) {
        node.value = sheet.name;
      }
    },
    [sheet.name]
  );

  if (isRenaming) {
    return (
      <input
        ref={inputRef}
        className="sheet-tab-input"
        data-order={sheet.order * 2}
        data-id={sheet.id}
        autoFocus={true}
        style={{
          // * 2 is needed so there's a space next to each tab
          order: sheet.order * 2,
        }}
        onKeyDown={(event) => {
          if (event.code === 'Enter') {
            setIsRenaming(false);
            const input = event.currentTarget as HTMLInputElement;
            if (input.value !== sheet.name) {
              sheetController.sheet.rename(input.value);
              localFiles.save();
            }
            focusGrid();
          } else if (event.code === 'Escape') {
            setIsRenaming(false);
            focusGrid();
          }
        }}
        onPointerDown={(event) => onPointerDown({ event, sheet })}
        onDoubleClick={() => setIsRenaming(true)}
        onBlur={(event) => {
          setIsRenaming(false);
          const input = event.currentTarget as HTMLInputElement;
          if (input.value !== sheet.name) {
            sheetController.sheet.rename(input.value);
            localFiles.save();
          }
          clearRename();
          focusGrid();
        }}
      />
    );
  }

  return (
    <div
      className={active ? 'sheet-tab-active' : 'sheet-tab'}
      data-order={sheet.order * 2}
      data-id={sheet.id}
      style={{
        // * 2 is needed so there's a space next to each tab
        order: sheet.order * 2,
      }}
      onPointerDown={(event) => onPointerDown({ event, sheet })}
      onDoubleClick={() => setIsRenaming(true)}
      onContextMenu={(e) => onContextMenu(e, sheet)}
    >
      {sheet.name}
    </div>
  );
};
