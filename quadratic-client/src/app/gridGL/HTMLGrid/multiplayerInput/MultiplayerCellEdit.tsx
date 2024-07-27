import { useEffect, useRef, useState } from 'react';

import { sheets } from '@/app/grid/controller/Sheets';
import type { MultiplayerCell } from '@/app/gridGL/HTMLGrid/multiplayerInput/MultiplayerCellEdits';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import type { CellFormatSummary } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

interface Props {
  multiplayerCellInput: MultiplayerCell;
}

const CURSOR_WIDTH = 2;

export const MultiplayerCellEdit = (props: Props) => {
  const input = props.multiplayerCellInput;
  const sheet = sheets.sheet;
  const cellOffsets = sheet.getCellOffsets(input.location.x, input.location.y);

  const [formatting, setFormatting] = useState<CellFormatSummary | undefined>();
  useEffect(() => {
    (async () => {
      const format = await quadraticCore.getCellFormatSummary(sheet.id, input.location.x, input.location.y, true);
      setFormatting(format);
    })();
  }, [input.location, sheet.id]);

  const displayItalic = input.cellEdit.italic === null ? formatting?.italic : input.cellEdit.italic;
  const displayBold = input.cellEdit.bold === null ? formatting?.bold : input.cellEdit.bold;
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
  const textCharacters = input.cellEdit.text ? [...input.cellEdit.text.split(''), ''] : [];

  return (
    <>
      <div
        className={`multiplayer-cell-edit-${input.sessionId}`}
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
          color: formatting?.textColor ?? 'black',
          padding: `0 ${CURSOR_THICKNESS}px 0 0`,
          margin: 0,
          lineHeight: `${cellOffsets.height - CURSOR_THICKNESS * 2}px`,
          verticalAlign: 'text-top',
          transformOrigin: '0 0',
          transform: `translate(${cellOffsets.x + CURSOR_THICKNESS}px, ${cellOffsets.y + CURSOR_THICKNESS}px)`,
          fontFamily,
          fontSize: '14px',
          backgroundColor: formatting?.fillColor ?? 'white',
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ position: 'relative' }}>
          {textCharacters.map((character, index) => {
            if (index === input.cellEdit.cursor) {
              return (
                <span key={index} style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: '100%',
                      width: `${CURSOR_WIDTH}px`,
                      backgroundColor: input.playerColor,
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
