import { useEffect, useRef, useState } from 'react';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import CellReference from '../types/cellReference';
import { focusGrid } from '../../../helpers/focusGrid';
import { PixiApp } from '../pixiApp/PixiApp';
import { Sheet } from '../../gridDB/Sheet';

interface CellInputProps {
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  container?: HTMLDivElement;
  app?: PixiApp;
  sheet: Sheet;
}

export const CellInput = (props: CellInputProps) => {
  const { interactionState, setInteractionState, app, container } = props;
  const viewport = app?.viewport;

  const [value, setValue] = useState<string | undefined>(undefined);

  const cellLocation = useRef(interactionState.cursorPosition);
  const textInput = useRef<HTMLInputElement>(null);
  // Effect for sizing the input width to the length of the value
  useEffect(() => {
    if (textInput.current) textInput.current.size = value?.length || 0 + 1;
  }, [value, textInput]);

  // If we don't have a viewport, we can't continue.
  if (!viewport || !container) return null;

  // Function used to move and scale the Input with the Grid
  function updateInputCSSTransform() {
    if (!app || !viewport || !container) return '';

    // Get world transform matrix
    let worldTransform = viewport.worldTransform;

    // Calculate position of input based on cell
    const cell = props.sheet.gridOffsets.getCell(cellLocation.current.x, cellLocation.current.y);
    let cell_offset_scaled = viewport.toScreen(
      cell.x,
      cell.y - 0.66 // magic number via experimentation
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

  // need this variable to cancel second closeInput call from blur after pressing Escape (this happens before the state can update)
  let closed = false;

  // When done editing with the input
  const closeInput = async (transpose = { x: 0, y: 0 } as CellReference, cancel = false) => {
    if (closed) return;
    closed = true;

    if (!cancel) {
      // Update Cell and dependent cells
      if (value === '') {
        props.sheet.deleteCells([
          {
            x: cellLocation.current.x,
            y: cellLocation.current.y,
          }
        ])
      } else {
        props.sheet.updateCells([{
          x: cellLocation.current.x,
          y: cellLocation.current.y,
          type: 'TEXT',
          value: value || '',
        }]);
      }
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
        // margin: '-7px -10px 0 0',
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
        }
      }}
    ></input>
  );
};
