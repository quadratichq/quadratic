import './SheetBarTab.css';

import { MouseEvent, PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Sheet } from '../../../grid/sheet/Sheet';
import { useLocalFiles } from '../../contexts/LocalFiles';
import { SheetController } from '../../../grid/controller/sheetController';
import { focusGrid } from '../../../helpers/focusGrid';
import { Box, Fade, Popper } from '@mui/material';

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
    <div ref={divRef}>
      {isRenaming && (
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
              focusGrid();
            }
          }}
          onInput={() => setNameExists(false)}
          onPointerDown={(event) => onPointerDown({ event, sheet })}
          onDoubleClick={() => setIsRenaming(true)}
          onBlur={(event) => {
            const input = event.currentTarget as HTMLInputElement;
            if (!input) return false;
            setIsRenaming(false);
            if (input.value !== sheet.name) {
              if (!sheetController.sheetNameExists(input.value)) {
                sheetController.sheet.rename(input.value);
                localFiles.save();
              } else {
                setNameExists(true);
                setTimeout(() => setNameExists(false), 1500);
              }
            }
            clearRename();
            focusGrid();
            return false;
          }}
        />
      )}

      {!isRenaming && (
        <div
          className={active ? 'sheet-tab-active' : 'sheet-tab'}
          data-order={sheet.order * 2}
          data-id={sheet.id}
          style={{
            borderBottomColor: sheet.color,
            // * 2 is needed so there's a space next to each tab
            order: sheet.order * 2,
          }}
          onPointerDown={(event) => onPointerDown({ event, sheet })}
          onDoubleClick={() => setIsRenaming(true)}
          onContextMenu={(e) => onContextMenu(e, sheet)}
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
