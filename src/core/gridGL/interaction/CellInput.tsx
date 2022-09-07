import { useEffect, useRef, useState } from 'react';
import { CELL_WIDTH, CELL_HEIGHT } from '../../../constants/gridConstants';
import { deleteCellsRange } from '../../actions/deleteCellsRange';
import { updateCellAndDCells } from '../../actions/updateCellAndDCells';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { Viewport } from 'pixi-viewport';
import CellReference from '../types/cellReference';
import { Size } from '../types/size';
import { focusGrid } from '../../../helpers/focusGrid';

interface CellInputProps {
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<
    React.SetStateAction<GridInteractionState>
  >;
  viewportRef: React.MutableRefObject<Viewport | undefined>;
  headerSize: Size;
  container?: HTMLDivElement;
}

export const CellInput = (props: CellInputProps) => {
  const { interactionState, setInteractionState, viewportRef, container } = props;

  const [value, setValue] = useState<string | undefined>(undefined);
  const cellLocation = useRef(interactionState.cursorPosition);
  const textInput = useRef<HTMLInputElement>(null);

  // Effect for sizing the input width to the length of the value
  useEffect(() => {
    if (textInput.current) textInput.current.size = value?.length || 0 + 1;
  }, [value, textInput]);

  // If we don't have a viewport, we can't continue.
  const viewport = viewportRef.current;
  if (!viewport || !container) return null;

  // Function used to move and scale the Input with the Grid
  function updateInputCSSTransform() {
    if (!viewport || !container) return '';

    // Get world transform matrix
    let worldTransform = viewport.worldTransform;

    // Calculate position of input based on cell
    let cell_offset_scaled = viewport.toScreen(
      cellLocation.current.x * CELL_WIDTH + 0.5,
      cellLocation.current.y * CELL_HEIGHT + 1
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

  // When done editing with the input
  const closeInput = async (transpose = { x: 0, y: 0 } as CellReference) => {
    // Update Cell and dependent cells
    if (value === '') {
      await deleteCellsRange(
        {
          x: cellLocation.current.x,
          y: cellLocation.current.y,
        },
        {
          x: cellLocation.current.x,
          y: cellLocation.current.y,
        }
      );
    } else {
      await updateCellAndDCells({
        x: cellLocation.current.x,
        y: cellLocation.current.y,
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
