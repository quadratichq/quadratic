/* eslint-disable @typescript-eslint/no-unused-vars */
import { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../atoms/editorInteractionStateAtom';
import { sheetController } from '../../grid/controller/SheetController';
import { focusGrid } from '../../helpers/focusGrid';
import { CURSOR_THICKNESS } from '../UI/Cursor';
import { pixiApp } from '../pixiApp/PixiApp';
import { Coordinate } from '../types/size';

interface CellInputProps {
  container?: HTMLDivElement;
}

export const CellInput = (props: CellInputProps) => {
  const { container } = props;
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);

  const viewport = pixiApp.viewport;

  const cellLocation = sheetController.sheet.cursor.cursorPosition;

  const text = useRef('');

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const changeInput = (e: any) => setVisible(e.detail.showInput);
    window.addEventListener('change-input', changeInput);
    return () => window.removeEventListener('change-input', changeInput);
  }, []);

  const cell_offsets = sheetController.sheet.gridOffsets.getCell(cellLocation.x, cellLocation.y);
  const cell = sheetController.sheet.getRenderCell(cellLocation.x, cellLocation.y);

  // handle temporary changes to bold and italic (via keyboard)
  const [temporaryBold, setTemporaryBold] = useState<undefined | boolean>();
  const [temporaryItalic, setTemporaryItalic] = useState<undefined | boolean>();
  let fontFamily = 'OpenSans';
  const italic = temporaryItalic === undefined ? cell?.italic : temporaryItalic;
  const bold = temporaryBold === undefined ? cell?.bold : temporaryBold;
  if (italic && bold) {
    fontFamily = 'OpenSans-BoldItalic';
  } else if (italic) {
    fontFamily = 'OpenSans-Italic';
  } else if (bold) {
    fontFamily = 'OpenSans-Bold';
  }

  // moves the cursor to the end of the input (since we're placing a single character that caused the input to open)
  const handleFocus = useCallback((e: any) => {
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
    }, 0);
  }, []);

  // Effect for sizing the input width to the length of the value
  const [textInput, setTextInput] = useState<HTMLDivElement>();
  const textInputRef = useCallback(
    (node: any) => {
      if (!node) return;
      node.focus();
      setTextInput(node);
      const value = cell?.value ? (cell?.value.type === 'text' ? cell.value.value : undefined) : undefined;
      text.current = pixiApp.settings.input.initialValue ?? (value || '');
      if (document.hasFocus() && node.contains(document.activeElement)) {
        handleFocus({ target: node });
      }
    },
    [cell?.value, handleFocus]
  );

  // If we don't have a viewport, we can't continue.
  if (!viewport || !container) return null;

  // If the cell is open in the code editor, don't show the input
  if (
    editorInteractionState.showCodeEditor &&
    editorInteractionState.selectedCell.x === cellLocation.x &&
    editorInteractionState.selectedCell.y === cellLocation.y
  )
    return null;

  // Function used to move and scale the Input with the Grid
  function updateInputCSSTransform() {
    if (!container) return '';

    // Get world transform matrix
    let worldTransform = viewport.worldTransform;

    // Calculate position of input based on cell (magic number via experimentation)
    let cell_offset_scaled = viewport.toScreen(cell_offsets.x + CURSOR_THICKNESS, cell_offsets.y + CURSOR_THICKNESS);

    // Generate transform CSS
    const transform =
      'matrix(' +
      [
        worldTransform.a,
        worldTransform.b,
        worldTransform.c,
        worldTransform.d,
        cell_offset_scaled.x + container.offsetLeft,
        cell_offset_scaled.y + container.offsetTop,
      ].join(',') +
      ')';

    // Update input css matrix
    if (textInput) textInput.style.transform = transform;

    // return transform
    return transform;
  }

  // If the input is not shown, we can do nothing and return null
  if (!visible) {
    return null;
  }

  // need this variable to cancel second closeInput call from blur after pressing Escape (this happens before the state can update)
  let closed = false;

  // When done editing with the input
  const closeInput = async (transpose = { x: 0, y: 0 } as Coordinate, cancel = false) => {
    if (closed || !textInput) return;
    closed = true;

    const value = textInput.innerText;

    if (!cancel && (value.trim() || cell?.value)) {
      sheetController.sheet.setCellValue(cellLocation.x, cellLocation.y, value);
      setTemporaryBold(undefined);
      setTemporaryItalic(undefined);
      textInput.innerText = '';
    }

    // Update Grid Interaction state, reset input value state
    const position = sheetController.sheet.cursor.cursorPosition;
    sheetController.sheet.cursor.changePosition({
      cursorPosition: {
        x: position.x + transpose.x,
        y: position.y + transpose.y,
      },
    });

    pixiApp.settings.changeInput(false);

    // Set focus back to Grid
    focusGrid();

    // Clean up listeners
    viewport.off('moved-end', updateInputCSSTransform);
    viewport.off('moved', updateInputCSSTransform);
  };

  // Register lister for when grid moves to resize and move input with CSS
  viewport.on('moved', updateInputCSSTransform);
  viewport.on('moved-end', updateInputCSSTransform);

  // set input's initial position correctly
  const transform = updateInputCSSTransform();

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
        minWidth: cell_offsets.width - CURSOR_THICKNESS * 2,
        outline: 'none',
        color: cell?.textColor ?? 'black',
        padding: `0 ${CURSOR_THICKNESS}px 0 0`,
        margin: 0,
        lineHeight: `${cell_offsets.height - CURSOR_THICKNESS * 2}px`,
        verticalAlign: 'text-top',
        transformOrigin: '0 0',
        transform,
        fontFamily,
        fontSize: '14px',
        backgroundColor: cell?.fillColor ?? 'white',
        whiteSpace: 'break-spaces',
      }}
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
        } else if (event.key === 'Tab') {
          closeInput({ x: 1, y: 0 });
          event.stopPropagation();
          event.preventDefault();
        } else if (event.key === 'Escape') {
          closeInput(undefined, true);
          event.preventDefault();
        } else if (event.key === 'ArrowUp') {
          closeInput({ x: 0, y: -1 });
        } else if (event.key === 'ArrowDown') {
          closeInput({ x: 0, y: 1 });
        } else if ((event.metaKey || event.ctrlKey) && event.key === 'p') {
          event.preventDefault();
        } else if (event.key === ' ') {
          // Don't propagate so panning mode doesn't get triggered
          event.stopPropagation();
        } else if (event.key === 'i' && (event.ctrlKey || event.metaKey)) {
          const italic = temporaryItalic === undefined ? !cell?.italic : !temporaryItalic;
          setTemporaryItalic(italic);
          sheetController.sheet.setCellItalic(new Rectangle(cellLocation.x, cellLocation.y, 0, 0), italic);
          event.stopPropagation();
          event.preventDefault();
        } else if (event.key === 'b' && (event.ctrlKey || event.metaKey)) {
          const bold = temporaryBold === undefined ? !cell?.italic : !temporaryBold;
          setTemporaryBold(bold);
          sheetController.sheet.setCellBold(new Rectangle(cellLocation.x, cellLocation.y, 0, 0), bold);
          event.stopPropagation();
          event.preventDefault();
        }
        // ensure the cell border is redrawn
        pixiApp.cursor.dirty = true;
      }}
    >
      {text.current}
    </div>
  );
};
