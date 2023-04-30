import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GridInteractionState } from '../../atoms/gridInteractionStateAtom';
import { Coordinate } from '../types/size';
import { focusGrid } from '../../helpers/focusGrid';
import { PixiApp } from '../pixiApp/PixiApp';
import { SheetController } from '../../grid/controller/sheetController';
import { updateCellAndDCells } from '../../grid/actions/updateCellAndDCells';
import { DeleteCells } from '../../grid/actions/DeleteCells';
import { EditorInteractionState } from '../../atoms/editorInteractionStateAtom';

interface CellInputProps {
  interactionState: GridInteractionState;
  editorInteractionState: EditorInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  container?: HTMLDivElement;
  app?: PixiApp;
  sheetController: SheetController;
}

export const CellInput = (props: CellInputProps) => {
  const { interactionState, editorInteractionState, setInteractionState, app, container, sheetController } = props;
  const viewport = app?.viewport;

  const cellLocation = interactionState.cursorPosition;

  const text = useRef('');
  const handleChange = useCallback((e) => {
    console.log(e.target.value);
    text.current = e.target.value;
  }, []);

  // Effect for sizing the input width to the length of the value
  const [textInput, setTextInput] = useState<HTMLDivElement>();
  const textInputRef = useCallback((node) => {
    node?.focus();
    setTextInput(node);
  }, []);

  const cell_offsets = sheetController.sheet.gridOffsets.getCell(cellLocation.x, cellLocation.y);
  const copy = sheetController.sheet.getCellAndFormatCopy(cellLocation.x, cellLocation.y);
  const cell = copy?.cell;
  const format = copy?.format;

  const fontFamily = useMemo(() => {
    if (!format) return 'OpenSans';
    if (format.italic && format.bold) return 'OpenSans-BoldItalic';
    if (format.italic) return 'OpenSans-Italic';
    if (format.bold) return 'OpenSans-Bold';
  }, [format]);

  useEffect(() => {
    if (cell?.value) {
      text.current = cell.value;
    }
  }, [cell?.value]);

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
    if (!app || !viewport || !container) return '';

    // Get world transform matrix
    let worldTransform = viewport.worldTransform;

    // Calculate position of input based on cell (magic number via experimentation)
    let cell_offset_scaled = viewport.toScreen(cell_offsets.x + 2, cell_offsets.y + 3);

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
  if (!interactionState.showInput) {
    return null;
  }

  // need this variable to cancel second closeInput call from blur after pressing Escape (this happens before the state can update)
  let closed = false;

  // When done editing with the input
  const closeInput = async (transpose = { x: 0, y: 0 } as Coordinate, cancel = false) => {
    if (closed || !textInput) return;
    closed = true;

    const value = textInput.innerText;

    if (!cancel) {
      // Update Cell and dependent cells
      if (value === '') {
        // delete cell if input is empty, and wasn't empty before
        if (cell !== undefined)
          DeleteCells({
            x0: cellLocation.x,
            y0: cellLocation.y,
            x1: cellLocation.x,
            y1: cellLocation.y,
            sheetController,
            app,
          });
      } else {
        // create cell with value at input location
        await updateCellAndDCells({
          starting_cells: [
            {
              x: cellLocation.x,
              y: cellLocation.y,
              type: 'TEXT',
              value: value || '',
            },
          ],
          sheetController,
          app,
        });
      }
      app.quadrants.quadrantChanged({ cells: [cellLocation] });
    }

    // Update Grid Interaction state, reset input value state
    setInteractionState({
      ...interactionState,
      keyboardMovePosition: {
        x: interactionState.cursorPosition.x + transpose.x,
        y: interactionState.cursorPosition.y + transpose.y,
      },
      cursorPosition: {
        x: interactionState.cursorPosition.x + transpose.x,
        y: interactionState.cursorPosition.y + transpose.y,
      },
      showInput: false,
      inputInitialValue: '',
    });
    // setValue(undefined);

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
      contentEditable={true}
      suppressContentEditableWarning={true}
      ref={textInputRef}
      spellCheck={false}
      style={{
        display: 'block',
        position: 'absolute',
        top: 0,
        left: 0,
        minWidth: 100,
        border: 'none',
        outline: 'solid',
        outlineColor: format?.fillColor ?? 'transparent',
        color: format?.textColor ?? 'black',
        padding: 0,
        margin: 0,
        lineHeight: '1',
        background: format?.fillColor ?? 'transparent',
        transformOrigin: '0 0',
        transform,
        fontFamily,
        fontSize: '14px',
        // letterSpacing: '0.07px',
      }}
      onChange={handleChange}
      onBlur={() => {
        closeInput();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          closeInput({ x: 0, y: 1 });
          event.preventDefault();
        } else if (event.key === 'Tab') {
          closeInput({ x: 1, y: 0 });
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
        }
      }}
    >
      {text.current}
    </div>
  );
};
