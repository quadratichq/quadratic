import { useRef, useState } from 'react';
import { CELL_WIDTH, CELL_HEIGHT } from '../../../constants/gridConstants';
import { deleteCellsRange } from '../../actions/deleteCellsRange';
import { updateCellAndDCells } from '../../actions/updateCellAndDCells';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { Viewport } from 'pixi-viewport';
import CellReference from '../types/cellReference';
import { focusGrid } from '../../../helpers/focusGrid';

interface CellInputProps {
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<
    React.SetStateAction<GridInteractionState>
  >;
  viewportRef: React.MutableRefObject<Viewport | undefined>;
}

export const CellInput = (props: CellInputProps) => {
  const { interactionState, setInteractionState, viewportRef } = props;

  const [value, setValue] = useState<string | undefined>(undefined);
  const cellLoation = useRef(interactionState.cursorPosition);
  const textInput = useRef<HTMLInputElement>(null);

  // If we don't have a viewport, we can't continue.
  const viewport = viewportRef.current;
  if (!viewport) return null;

  // Function used to move and scale the Input with the Grid
  function updateInputCSSTransform() {
    if (!viewport) return '';

    // Get world transform matrix
    let worldTransform = viewport.worldTransform;

    // Calculate position of input based on cell
    let cell_offset_scaled = viewport.toScreen(
      cellLoation.current.x * CELL_WIDTH + 0.5,
      cellLoation.current.y * CELL_HEIGHT + 1
    );

    // Generate transform CSS
    const transform =
      'matrix(' +
      [
        worldTransform.a,
        worldTransform.b,
        worldTransform.c,
        worldTransform.d,
        cell_offset_scaled.x,
        cell_offset_scaled.y,
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

  // When done editing with the input
  const closeInput = async (transpose = { x: 0, y: 0 } as CellReference) => {
    // Update Cell and dependent cells
    if (value === '') {
      await deleteCellsRange(
        {
          x: cellLoation.current.x,
          y: cellLoation.current.y,
        },
        {
          x: cellLoation.current.x,
          y: cellLoation.current.y,
        }
      );
    } else {
      await updateCellAndDCells({
        x: cellLoation.current.x,
        y: cellLoation.current.y,
        type: 'TEXT',
        value: value || '',
      });
    }

    // Update Grid Interaction state, reset input value state
    setInteractionState({
      ...interactionState,
      ...{
        cursorPosition: {
          x: interactionState.cursorPosition.x + transpose.x,
          y: interactionState.cursorPosition.y + transpose.y,
        },
        showInput: false,
        inputInitialValue: '',
      },
    });
    setValue(undefined);

    // Set focus back to Grid
    focusGrid();

    // Clean up listeners
    // NOTE: this may accidentally cancel events registered elsewhere
    viewport.removeListener('moved-end');
    viewport.removeListener('moved');
  };

  // Happens when a cell is being edited
  if (value === undefined && value !== interactionState.inputInitialValue) {
    // Set initial value and remember this cells position.
    setValue(interactionState.inputInitialValue);
    cellLoation.current = interactionState.cursorPosition;

    // Register lister for when grid moves to resize and move input with CSS
    viewport.addListener('moved', updateInputCSSTransform);
    viewport.addListener('moved-end', updateInputCSSTransform);
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
        width: 100,
        border: 'none',
        outline: 'none',
        lineHeight: '1',
        background: 'none',
        transformOrigin: '0 0',
        transform: transform,
        fontSize: '14px',
        letterSpacing: '0.015em',
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
        } else if (event.key === 'Tab') {
          closeInput({ x: 1, y: 0 });
          event.preventDefault();
        } else if (event.key === 'Escape') {
          closeInput();
        }
      }}
    ></input>
  );
};
