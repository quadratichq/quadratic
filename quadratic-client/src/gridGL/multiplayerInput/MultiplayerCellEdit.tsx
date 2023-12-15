import { useEffect, useRef } from 'react';
import { sheets } from '../../grid/controller/Sheets';
import { CURSOR_THICKNESS } from '../UI/Cursor';
import { pixiApp } from '../pixiApp/PixiApp';
import { MultiplayerCell } from './useMultiplayerCellEdit';

interface Props {
  container: HTMLDivElement;
  multiplayerCellInput: MultiplayerCell;
}

const CURSOR_WIDTH = 2;

export const MultiplayerCellEdit = (props: Props) => {
  const { container } = props;

  const { cell, italic, bold, text, cursor, playerColor, sessionId } = props.multiplayerCellInput;
  const viewport = pixiApp.viewport;
  const sheet = sheets.sheet;
  const cellOffsets = sheet.getCellOffsets(cell.x, cell.y);

  const formatting = sheet.getCellFormatSummary(cell.x, cell.y);
  const displayItalic = italic === null ? formatting?.italic : italic;
  const displayBold = bold === null ? formatting?.bold : bold;
  let fontFamily: string = 'OpenSans';
  if (displayItalic && displayBold) {
    fontFamily = 'OpenSans-BoldItalic';
  } else if (displayItalic) {
    fontFamily = 'OpenSans-Italic';
  } else if (displayBold) {
    fontFamily = 'OpenSans-Bold';
  }

  const textInput = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Register lister for when grid moves to resize and move input with CSS
    viewport.on('moved', updateInputCSSTransform);
    viewport.on('moved-end', updateInputCSSTransform);

    return () => {
      viewport.off('moved-end', updateInputCSSTransform);
      viewport.off('moved', updateInputCSSTransform);
    };
  });

  // If we don't have a viewport, we can't continue.
  if (!viewport) return null;

  // Function used to move and scale the Input with the Grid
  function updateInputCSSTransform() {
    if (!container) return '';

    // Get world transform matrix
    let worldTransform = viewport.worldTransform;

    // Calculate position of input based on cell (magic number via experimentation)
    let cell_offset_scaled = viewport.toScreen(cellOffsets.x + CURSOR_THICKNESS, cellOffsets.y + CURSOR_THICKNESS);

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

  // set input's initial position correctly
  const transform = updateInputCSSTransform();

  // need to add one extra character at end in case the cursor is there
  const textCharacters = text ? [...text.split(''), ''] : [];

  return (
    <>
      <div
        className={`multiplayer-cell-edit-${sessionId}`}
        contentEditable={true}
        suppressContentEditableWarning={true}
        ref={textInput}
        spellCheck={false}
        style={{
          display: 'table-cell',
          position: 'absolute',
          top: 0,
          left: 0,
          minWidth: cellOffsets.width - CURSOR_THICKNESS * 2,
          outline: 'none',
          color: formatting.textColor ?? 'black',
          padding: `0 ${CURSOR_THICKNESS}px 0 0`,
          margin: 0,
          lineHeight: `${cellOffsets.height - CURSOR_THICKNESS * 2}px`,
          verticalAlign: 'text-top',
          transformOrigin: '0 0',
          transform,
          fontFamily,
          fontSize: '14px',
          backgroundColor: formatting.fillColor ?? 'white',
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ position: 'relative' }}>
          {textCharacters.map((character, index) => {
            if (index === cursor) {
              return (
                <span key={index} style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: '100%',
                      width: `${CURSOR_WIDTH}px`,
                      backgroundColor: playerColor,
                    }}
                  />
                  <span>{character}</span>
                </span>
              );
            } else {
              return character;
            }
          })}
        </div>
      </div>
    </>
  );
};
