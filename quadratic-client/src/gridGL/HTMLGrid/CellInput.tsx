import { multiplayer } from '@/multiplayer/multiplayer';
import { Rectangle } from 'pixi.js';
import { ClipboardEvent, useCallback, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../atoms/editorInteractionStateAtom';
import { sheets } from '../../grid/controller/Sheets';
import { focusGrid } from '../../helpers/focusGrid';
import { CURSOR_THICKNESS } from '../UI/Cursor';
import { getCursorLocation, isCursorAtEnd, isCursorAtStart } from '../interaction/contentEditableHelper';
import { pixiApp } from '../pixiApp/PixiApp';
import { pixiAppSettings } from '../pixiApp/PixiAppSettings';
import { Coordinate } from '../types/size';

export const CellInput = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

  const viewport = pixiApp.viewport;

  const sheet = sheets.sheet;
  const cellLocation = sheet.cursor.cursorPosition;

  const text = useRef('');

  const cellOffsets = sheet.getCellOffsets(cellLocation.x, cellLocation.y);
  const cell = sheet.getEditCell(cellLocation.x, cellLocation.y);
  const formatting = sheet.getCellFormatSummary(cellLocation.x, cellLocation.y);

  // handle temporary changes to bold and italic (via keyboard)
  const [temporaryBold, setTemporaryBold] = useState<undefined | boolean>();
  const [temporaryItalic, setTemporaryItalic] = useState<undefined | boolean>();
  let fontFamily = 'OpenSans';
  const italic = temporaryItalic === undefined ? formatting?.italic : temporaryItalic;
  const bold = temporaryBold === undefined ? formatting?.bold : temporaryBold;
  if (italic && bold) {
    fontFamily = 'OpenSans-BoldItalic';
  } else if (italic) {
    fontFamily = 'OpenSans-Italic';
  } else if (bold) {
    fontFamily = 'OpenSans-Bold';
  }

  // moves the cursor to the end of the input (since we're placing a single character that caused the input to open)
  const handleFocus = useCallback(
    (e: any) => {
      const div = e.target;
      window.setTimeout(() => {
        if (!document.hasFocus() || !div.contains(document.activeElement)) return;
        if (div.innerText?.length) {
          const selection = document.getSelection();
          const range = document.createRange();
          if (selection) {
            range.setStart(div.childNodes[0], div.innerText.length);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
        multiplayer.sendCellEdit(
          div.innerText ?? '',
          div.innerText?.length ?? 0,
          false,
          temporaryBold,
          temporaryItalic
        );
      }, 0);
    },
    [temporaryBold, temporaryItalic]
  );

  // Effect for sizing the input width to the length of the value
  const [textInput, setTextInput] = useState<HTMLDivElement>();
  const textInputRef = useCallback(
    (node: any) => {
      if (!node) return;
      node.focus();
      setTextInput(node);
      const value = cell;
      text.current = pixiAppSettings.input.initialValue ?? (value || '');
      if (document.hasFocus() && node.contains(document.activeElement)) {
        handleFocus({ target: node });
      }
    },
    [cell, handleFocus]
  );

  // If the cell is open in the code editor, don't show the input
  if (
    editorInteractionState.showCodeEditor &&
    editorInteractionState.selectedCell.x === cellLocation.x &&
    editorInteractionState.selectedCell.y === cellLocation.y
  )
    return null;

  const transform = `translate(${cellOffsets.x + CURSOR_THICKNESS}px, ${cellOffsets.y + CURSOR_THICKNESS}px)`;

  // need this variable to cancel second closeInput call from blur after pressing Escape (this happens before the state can update)
  let closed = false;

  // When done editing with the input
  const closeInput = async (transpose = { x: 0, y: 0 } as Coordinate, cancel = false) => {
    if (closed || !textInput) return;
    closed = true;

    const value = textInput.innerText;

    if (!cancel && (value.trim() || cell)) {
      sheet.setCellValue(cellLocation.x, cellLocation.y, value);
      setTemporaryBold(undefined);
      setTemporaryItalic(undefined);
      textInput.innerText = '';
    }

    // Update Grid Interaction state, reset input value state
    const position = sheet.cursor.cursorPosition;
    sheet.cursor.changePosition({
      cursorPosition: {
        x: position.x + transpose.x,
        y: position.y + transpose.y,
      },
    });

    pixiAppSettings.changeInput(false);

    // Set focus back to Grid
    focusGrid();
  };

  const handlePaste = (event: ClipboardEvent) => {
    const text = event.clipboardData?.getData('text') || '';
    const parsed = new DOMParser().parseFromString(text, 'text/html');
    const result = parsed.body.textContent || '';
    document.execCommand('insertHTML', false, result.replace(/(\r\n|\n|\r)/gm, ''));
    if (textInput) {
      multiplayer.sendCellEdit(textInput.innerText, getCursorLocation(), false, temporaryBold, temporaryItalic);
    }
    event.preventDefault();
  };

  const arrowRight = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isCursorAtEnd(event.currentTarget)) {
      closeInput({ x: 1, y: 0 });
      event.stopPropagation();
      event.preventDefault();
    }
  };

  const arrowLeft = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isCursorAtStart()) {
      closeInput({ x: -1, y: 0 });
      event.stopPropagation();
      event.preventDefault();
    }
  };

  return (
    <div
      id="cell-edit"
      contentEditable={true}
      suppressContentEditableWarning={true}
      ref={textInputRef}
      spellCheck={false}
      style={{
        display: 'table-cell',
        position: 'absolute',
        top: 0,
        left: 0,
        minWidth: cellOffsets.width - CURSOR_THICKNESS * 2,
        outline: 'none',
        color: formatting?.textColor ?? 'black',
        padding: `0 ${CURSOR_THICKNESS}px 0 0`,
        margin: 0,
        lineHeight: `${cellOffsets.height - CURSOR_THICKNESS * 2}px`,
        verticalAlign: 'text-top',
        transformOrigin: '0 0',
        transform,
        fontFamily,
        fontSize: '14px',
        backgroundColor: formatting?.fillColor ?? 'white',
        whiteSpace: 'nowrap',
        pointerEvents: 'auto',
      }}
      onPaste={handlePaste}
      onInput={() => {
        // viewport should try to keep the input box in view
        if (!textInput) return;
        const bounds = textInput.getBoundingClientRect();
        const canvas = pixiApp.canvas.getBoundingClientRect();
        const center = pixiApp.viewport.center;
        const scale = pixiApp.viewport.scale.x;
        let x = center.x,
          y = center.y,
          move = false;
        if (bounds.right > canvas.right) {
          x = center.x + (bounds.right - canvas.right) / scale;
          move = true;
        } else if (bounds.left < canvas.left) {
          const change = (bounds.left - canvas.left) / scale;
          if (bounds.right < canvas.right + change) {
            x = center.x + change;
            move = true;
          }
        }
        if (bounds.bottom > canvas.bottom) {
          y = center.y + (bounds.bottom - canvas.bottom) / scale;
          move = true;
        } else if (bounds.top < canvas.top) {
          const change = (bounds.top - canvas.top) / scale;
          if (bounds.bottom < canvas.bottom + change) {
            y = center.y + change;
            move = true;
          }
        }
        if (move) {
          viewport.moveCenter(x, y);
          pixiApp.setViewportDirty();
        }
      }}
      onFocus={handleFocus}
      onBlur={() => closeInput()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          closeInput({ x: 0, y: 1 });
          event.stopPropagation();
          event.preventDefault();
        } else if (event.key === '=' && (!textInput || textInput.innerText.length === 0)) {
          // Open cell type menu, close editor.
          setEditorInteractionState({
            ...editorInteractionState,
            showCodeEditor: true,
            waitingForEditorClose: {
              selectedCell: { x: cellLocation.x, y: cellLocation.y },
              selectedCellSheet: sheets.sheet.id,
              mode: 'Python',
              showCellTypeMenu: true,
            },
          });
          pixiAppSettings.changeInput(false);
          event.stopPropagation();
        } else if (event.key === 'Tab') {
          if (event.shiftKey) closeInput({ x: -1, y: 0 });
          else closeInput({ x: 1, y: 0 });
          event.stopPropagation();
          event.preventDefault();
        } else if (event.key === 'Escape') {
          closeInput(undefined, true);
          event.preventDefault();
        } else if (event.key === 'ArrowUp') {
          closeInput({ x: 0, y: -1 });
          event.stopPropagation();
        } else if (event.key === 'ArrowDown') {
          closeInput({ x: 0, y: 1 });
          event.stopPropagation();
        } else if (event.key === 'ArrowRight') {
          arrowRight(event);
        } else if (event.key === 'ArrowLeft') {
          arrowLeft(event);
        } else if ((event.metaKey || event.ctrlKey) && event.key === 'p') {
          event.preventDefault();
        } else if (event.key === ' ') {
          // Don't propagate so panning mode doesn't get triggered
          event.stopPropagation();
        } else if (event.key === 'i' && (event.ctrlKey || event.metaKey)) {
          const italic = temporaryItalic === undefined ? !formatting?.italic : !temporaryItalic;
          setTemporaryItalic(italic);
          sheet.setCellItalic(new Rectangle(cellLocation.x, cellLocation.y, 0, 0), italic);
          event.stopPropagation();
          event.preventDefault();
        } else if (event.key === 'b' && (event.ctrlKey || event.metaKey)) {
          const bold = temporaryBold === undefined ? !formatting?.italic : !temporaryBold;
          setTemporaryBold(bold);
          sheet.setCellBold(new Rectangle(cellLocation.x, cellLocation.y, 0, 0), bold);
          event.stopPropagation();
          event.preventDefault();
        }
        // ensure the cell border is redrawn
        pixiApp.cursor.dirty = true;
      }}
      onKeyUp={() => {
        if (textInput) {
          multiplayer.sendCellEdit(textInput.innerText, getCursorLocation(), false, temporaryBold, temporaryItalic);
        }
      }}
    >
      {text.current}
    </div>
  );
};
