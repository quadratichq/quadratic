import { sheets } from '@/app/grid/controller/Sheets';
import type { MultiplayerCell } from '@/app/gridGL/HTMLGrid/multiplayerInput/MultiplayerCellEdits';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import type { CellFormatSummary } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { DEFAULT_FONT_SIZE } from '@/shared/constants/gridConstants';
import { useEffect, useRef, useState } from 'react';

interface Props {
  multiplayerCellInput: MultiplayerCell;
}

const CURSOR_WIDTH = 2;

export const MultiplayerCellEdit = (props: Props) => {
  const input = props.multiplayerCellInput;
  const sheet = sheets.sheet;

  // Check if the cell is part of a merged cell and get the full merged cell rect
  const mergeRect = sheet.getMergeCellRect(input.location.x, input.location.y);
  const cellOffsets = mergeRect
    ? sheet.getScreenRectangle(
        Number(mergeRect.min.x),
        Number(mergeRect.min.y),
        Number(mergeRect.max.x) - Number(mergeRect.min.x) + 1,
        Number(mergeRect.max.y) - Number(mergeRect.min.y) + 1
      )
    : sheet.getCellOffsets(input.location.x, input.location.y);

  const [formatting, setFormatting] = useState<CellFormatSummary | undefined>();
  useEffect(() => {
    (async () => {
      const format = await quadraticCore.getCellFormatSummary(sheet.id, input.location.x, input.location.y);
      setFormatting(format);
    })();
  }, [input.location, sheet.id]);

  const displayItalic = input.cellEdit.italic === undefined ? formatting?.italic : input.cellEdit.italic;
  const displayBold = input.cellEdit.bold === undefined ? formatting?.bold : input.cellEdit.bold;
  const displayUnderline = input.cellEdit.underline === undefined ? formatting?.underline : input.cellEdit.underline;
  const displayStrikeThrough =
    input.cellEdit.strikeThrough === undefined ? formatting?.strikeThrough : input.cellEdit.strikeThrough;
  const fontSize = formatting?.fontSize ?? DEFAULT_FONT_SIZE;
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
          fontSize: `${fontSize}px`,
          backgroundColor: formatting?.fillColor ?? 'white',
          whiteSpace: 'nowrap',
          textDecoration: `${displayUnderline ? 'underline' : ''} ${displayStrikeThrough ? 'line-through' : ''}`,
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
