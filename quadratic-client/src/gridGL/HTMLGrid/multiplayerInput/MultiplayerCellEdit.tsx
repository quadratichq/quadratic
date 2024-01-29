import { useRef } from 'react';
import { sheets } from '../../../grid/controller/Sheets';
import { CURSOR_THICKNESS } from '../../UI/Cursor';
import { MultiplayerCell } from './MultiplayerCellEdits';

interface Props {
  multiplayerCellInput: MultiplayerCell;
}

const CURSOR_WIDTH = 2;

export const MultiplayerCellEdit = (props: Props) => {
  const { cell, italic, bold, text, cursor, playerColor, sessionId } = props.multiplayerCellInput;
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
          transform: `translate(${cellOffsets.x + CURSOR_THICKNESS}px, ${cellOffsets.y + CURSOR_THICKNESS}px)`,
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
