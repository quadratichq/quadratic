import './SheetBarTab.css';

import { Box, Fade, Popper } from '@mui/material';
import { MouseEvent, PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { SheetController } from '../../../grid/controller/_sheetController';
import { Sheet } from '../../../grid/sheet/Sheet';
import { focusGrid } from '../../../helpers/focusGrid';
import { useLocalFiles } from '../../contexts/LocalFiles';

interface Props {
  sheet: Sheet;
  order: string;
  sheetController: SheetController;
  active: boolean;
  onPointerDown: (options: { event: PointerEvent<HTMLDivElement>; sheet: Sheet }) => void;
  onContextMenu: (event: MouseEvent, sheet: Sheet) => void;
  forceRename: boolean;
  clearRename: () => void;
}

export const SheetBarTab = (props: Props): JSX.Element => {
  const { sheet, order, sheetController, active, onPointerDown, onContextMenu, forceRename, clearRename } = props;
  const localFiles = useLocalFiles();
  const [nameExists, setNameExists] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    if (forceRename) {
      setIsRenaming(true);
    }
  }, [forceRename]);

  const divRef = useRef<HTMLDivElement | null>(null);

  const inputRef = useCallback(
    (node: HTMLInputElement) => {
      if (node) {
        node.value = sheet.name;
      }
    },
    [sheet.name]
  );

  return (
    <div
      ref={divRef}
      style={{
        order,
      }}
      data-id={sheet.id}
      data-order={sheet.order}
      onPointerDown={(event) => onPointerDown({ event, sheet })}
      onDoubleClick={() => setIsRenaming(true)}
      onContextMenu={(e) => onContextMenu(e, sheet)}
    >
      {isRenaming && (
        <input
          ref={inputRef}
          className="sheet-tab-input"
          autoFocus={true}
          onKeyDown={(event) => {
            if (event.code === 'Enter') {
              const input = event.currentTarget as HTMLInputElement;
              if (input.value !== sheet.name) {
                if (sheetController.sheetNameExists(input.value)) {
                  setNameExists(true);
                  input.focus();
                  return;
                } else {
                  setNameExists(false);
                  setIsRenaming(false);
                  sheetController.sheet.rename(input.value);
                  localFiles.save();
                }
              }
              focusGrid();
            } else if (event.code === 'Escape') {
              setIsRenaming(false);
              setNameExists(false);
              focusGrid();
            }
          }}
          onInput={() => setNameExists(false)}
          onBlur={(event) => {
            const input = event.currentTarget as HTMLInputElement;
            if (!input) return false;
            if (!isRenaming) return;
            setIsRenaming((isRenaming) => {
              if (!isRenaming) return false;
              if (input.value !== sheet.name) {
                if (!sheetController.sheetNameExists(input.value)) {
                  sheetController.sheet.rename(input.value);
                  localFiles.save();
                } else {
                  setNameExists(true);
                  setTimeout(() => setNameExists(false), 1500);
                }
              }
              return false;
            });
            clearRename();
            focusGrid();
            return false;
          }}
        />
      )}

      {!isRenaming && (
        <div
          className={active ? 'sheet-tab-active' : 'sheet-tab'}
          style={{
            borderBottomColor: sheet.color,
          }}
        >
          {sheet.name}
        </div>
      )}

      <Popper open={nameExists} anchorEl={divRef.current} transition>
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={350}>
            <Box sx={{ border: 1, p: 0.5, marginBottom: 1, backgroundColor: 'rgba(255, 0, 0, 0.25)' }}>
              Sheet name must be unique
            </Box>
          </Fade>
        )}
      </Popper>
    </div>
  );
};
