import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { getA1Notation } from '@/app/gridGL/UI/gridHeadings/getA1Notation';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import AddLocationIcon from '@mui/icons-material/AddLocation';
import { IconButton } from '@mui/material';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const CodeEditorRefButton = () => {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);

  const [disabled, setDisabled] = useState(true);
  useEffect(() => {
    const checkDisabled = () => {
      setDisabled(
        editorInteractionState.selectedCell.x === sheets.sheet.cursor.originPosition.x &&
          editorInteractionState.selectedCell.y === sheets.sheet.cursor.originPosition.y &&
          editorInteractionState.selectedCellSheet === sheets.sheet.id &&
          !sheets.sheet.cursor.multiCursor
      );
    };
    events.on('cursorPosition', checkDisabled);
    return () => {
      events.off('cursorPosition', checkDisabled);
    };
  });

  const addRef = () => {
    const { selectedCell, selectedCellSheet, mode: language } = editorInteractionState;
    let ref = '';
    let sheet = '';
    const cursor = sheets.sheet.cursor;
    if (selectedCellSheet !== sheets.sheet.id) {
      sheet = sheets.sheet.name;
    }
    if (language === 'Formula') {
      if (cursor.multiCursor) {
        const startLocation = cursor.multiCursor.originPosition;
        const start = getA1Notation(startLocation.x, startLocation.y);
        const endLocation = cursor.multiCursor.terminalPosition;
        const end = getA1Notation(endLocation.x, endLocation.y);
        if (sheet) {
          ref = `'${sheet}'!${start}:${end}`;
        } else {
          ref = `${start}:${end}`;
        }
      } else {
        const location = cursor.originPosition;
        const a1Notation = getA1Notation(location.x, location.y);
        if (sheet) {
          ref = `'${sheet}'!${a1Notation}`;
        } else {
          ref = a1Notation;
        }
      }
    } else if (language === 'Python') {
      if (cursor.multiCursor) {
        const start = cursor.multiCursor.originPosition;
        const end = cursor.multiCursor.terminalPosition;
        if (sheet) {
          ref = `cells((${start.x}, ${start.y}), (${end.x}, ${end.y}), '${sheet}')`;
        } else {
          ref = `rel_cells((${start.x - selectedCell.x}, ${start.y - selectedCell.y}), (${end.x - selectedCell.x}, ${
            end.y - selectedCell.y
          }))`;
        }
      } else {
        const location = cursor.originPosition;
        if (sheet) {
          ref = `cell(${location.x}, ${location.y}, '${sheet}')`;
        } else {
          ref = `rel_cell(${location.x - selectedCell.x}, ${location.y - selectedCell.y})`;
        }
      }
    } else if (language === 'Javascript') {
      if (cursor.multiCursor) {
        const start = cursor.multiCursor.originPosition;
        const end = cursor.multiCursor.terminalPosition;
        if (sheet) {
          ref = `cells((${start.x}, ${start.y}), (${end.x}, ${end.y}), '${sheet}')`;
        } else {
          ref = `relCells((${start.x - selectedCell.x}, ${start.y - selectedCell.y}), (${end.x - selectedCell.x}, ${
            end.y - selectedCell.y
          }))`;
        }
      } else {
        const location = cursor.originPosition;
        if (sheet) {
          ref = `cell(${location.x}, ${location.y}, '${sheet}')`;
        } else {
          ref = `relCell(${location.x - selectedCell.x}, ${location.y - selectedCell.y})`;
        }
      }
    }
    events.emit('insertCodeEditorText', ref);
  };

  return (
    <div className="code-editor-ref-button">
      <TooltipHint title="Insert cell reference" placement="bottom">
        <span>
          <IconButton disabled={disabled} size="small" onClick={addRef}>
            <AddLocationIcon fontSize="small" />
          </IconButton>
        </span>
      </TooltipHint>
    </div>
  );
};
