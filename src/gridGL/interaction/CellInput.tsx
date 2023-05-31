import { useEffect, useRef, useState } from 'react';
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

  const [value, setValue] = useState<string | undefined>(undefined);

  // used to save interaction state when input starts
  const [saveInteractionState, setSaveInteractionState] = useState<GridInteractionState>();

  const cellLocation = useRef(interactionState.cursorPosition);
  const textInput = useRef<HTMLInputElement>(null);
  // Effect for sizing the input width to the length of the value
  useEffect(() => {
    if (textInput.current) textInput.current.size = value?.length || 0 + 1;
  }, [value, textInput]);

  // If we don't have a viewport, we can't continue.
  if (!viewport || !container) return null;

  const cell_offsets = sheetController.sheet.gridOffsets.getCell(cellLocation.current.x, cellLocation.current.y);
  const cell = sheetController.sheet.getCellCopy(cellLocation.current.x, cellLocation.current.y);

  // If the cell is open in the code editor, don't show the input
  if (
    editorInteractionState.showCodeEditor &&
    editorInteractionState.selectedCell.x === cellLocation.current.x &&
    editorInteractionState.selectedCell.y === cellLocation.current.y
  )
    return null;

  // Function used to move and scale the Input with the Grid
  function updateInputCSSTransform() {
    if (!app || !viewport || !container) return '';

    // Get world transform matrix
    let worldTransform = viewport.worldTransform;

    // Calculate position of input based on cell
    let cell_offset_scaled = viewport.toScreen(
      cell_offsets.x,
      cell_offsets.y - 0.66 // magic number via experimentation
    );

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
    if (textInput.current) textInput.current.style.transform = transform;

    // return transform
    return transform;
  }

  // If the input is not shown, we can do nothing and return null
  if (!interactionState.showInput) {
    return null;
  }

  // copy interaction state when input starts
  if (!saveInteractionState) {
    setSaveInteractionState(interactionState);
  }

  // need this variable to cancel second closeInput call from blur after pressing Escape (this happens before the state can update)
  let closed = false;

  // When done editing with the input
  const closeInput = async (transpose = { x: 0, y: 0 } as Coordinate, cancel = false) => {
    if (closed) return;
    closed = true;

    if (!cancel) {
      sheetController.start_transaction(saveInteractionState);
      // Update Cell and dependent cells
      if (value === '') {
        // delete cell if input is empty, and wasn't empty before
        if (cell !== undefined)
          DeleteCells({
            x0: cellLocation.current.x,
            y0: cellLocation.current.y,
            x1: cellLocation.current.x,
            y1: cellLocation.current.y,
            sheetController,
            app,
            create_transaction: false,
          });
      } else {
        // create cell with value at input location
        await updateCellAndDCells({
          starting_cells: [
            {
              x: cellLocation.current.x,
              y: cellLocation.current.y,
              type: 'TEXT',
              value: value || '',
            },
          ],
          sheetController,
          app,
          create_transaction: false,
        });
      }
      sheetController.end_transaction();
      app.quadrants.quadrantChanged({ cells: [cellLocation.current] });
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
    setValue(undefined);

    setSaveInteractionState(undefined);

    // Set focus back to Grid
    focusGrid();

    // Clean up listeners
    viewport.off('moved-end', updateInputCSSTransform);
    viewport.off('moved', updateInputCSSTransform);
  };

  // Happens when a cell is being edited
  if (value === undefined && value !== interactionState.inputInitialValue) {
    // Set initial value and remember this cells position.
    setValue(interactionState.inputInitialValue);
    cellLocation.current = interactionState.cursorPosition;

    // Register lister for when grid moves to resize and move input with CSS
    viewport.on('moved', updateInputCSSTransform);
    viewport.on('moved-end', updateInputCSSTransform);
  }

  // set input's initial position correctly
  const transform = updateInputCSSTransform();

  return (
    <input
      autoFocus
      ref={textInput}
      spellCheck={false}
      style={{
        display: 'block',
        position: 'absolute',
        top: 0,
        left: 0,
        minWidth: 100,
        border: 'none',
        outline: 'none',
        lineHeight: '1',
        background: 'none',
        transformOrigin: '0 0',
        transform,
        fontFamily: 'OpenSans',
        fontSize: '14px',
        letterSpacing: '0.07px',
      }}
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
      }}
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
    ></input>
  );
};
