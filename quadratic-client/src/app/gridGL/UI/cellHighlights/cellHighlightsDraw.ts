import type { Graphics } from 'pixi.js';

import { DASHED, DASHED_THICKNESS, dashedTextures } from '@/app/gridGL/dashedTextures';
import type { CursorCell } from '@/app/gridGL/UI/Cursor';
import { CURSOR_THICKNESS, FILL_ALPHA } from '@/app/gridGL/UI/Cursor';

export function drawDashedRectangle(options: {
  g: Graphics;
  color: number;
  isSelected: boolean;
  startCell: CursorCell;
  endCell?: CursorCell;
}) {
  const { g, color, isSelected, startCell, endCell } = options;
  const minX = Math.min(startCell.x, endCell?.x ?? Infinity);
  const minY = Math.min(startCell.y, endCell?.y ?? Infinity);
  const maxX = Math.max(startCell.width + startCell.x, endCell ? endCell.x + endCell.width : -Infinity);
  const maxY = Math.max(startCell.y + startCell.height, endCell ? endCell.y + endCell.height : -Infinity);

  const path = [
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
    [minX, minY],
  ];

  // have to fill a rect because setting multiple line styles makes it unable to be filled
  if (isSelected) {
    g.lineStyle({
      alignment: 0,
    });
    g.moveTo(minX, minY);
    g.beginFill(color, FILL_ALPHA);
    g.drawRect(minX, minY, maxX - minX, maxY - minY);
    g.endFill();
  }

  g.moveTo(minX, minY);
  for (let i = 0; i < path.length; i++) {
    const texture = i % 2 === 0 ? dashedTextures.dashedHorizontal : dashedTextures.dashedVertical;
    g.lineStyle({
      width: CURSOR_THICKNESS,
      color,
      alignment: 0,
      texture,
    });
    g.lineTo(path[i][0], path[i][1]);
  }
}

export function drawDashedRectangleMarching(g: Graphics, color: number, startCell: CursorCell, march: number) {
  const minX = startCell.x;
  const minY = startCell.y;
  const maxX = startCell.width + startCell.x;
  const maxY = startCell.y + startCell.height;

  g.clear();

  g.lineStyle({
    alignment: 0,
  });
  g.moveTo(minX, minY);
  g.beginFill(color, FILL_ALPHA);
  g.drawRect(minX, minY, maxX - minX, maxY - minY);
  g.endFill();

  g.lineStyle({
    width: CURSOR_THICKNESS,
    color,
    alignment: 0,
  });

  const clamp = (n: number, min: number, max: number): number => {
    return Math.min(Math.max(n, min), max);
  };

  // This is a bit hacky of an algorithm to ensure the corners are squared and
  // never show less than DASHED_THICKNESS in size. The if statements are to
  // remove lines that are less than the DASHED_THICKNESS.

  let wrapAmount = 0;

  // draw top line
  for (let x = minX + march; x <= maxX - DASHED / 2; x += DASHED) {
    g.moveTo(clamp(x, minX, maxX), minY);
    g.lineTo(clamp(x + DASHED / 2, minX, maxX), minY);
    wrapAmount = x - (maxX - DASHED / 2);
  }

  // draw right line
  for (let y = minY + wrapAmount; y <= maxY - DASHED / 2; y += DASHED) {
    if (y + DASHED / 2 > minY + DASHED_THICKNESS) {
      g.moveTo(maxX, clamp(y, minY, maxY));
      g.lineTo(maxX, clamp(y + DASHED / 2, minY, maxY));
      wrapAmount = y + DASHED / 2 - maxY;
    }
  }

  // draw bottom line
  for (let x = maxX - wrapAmount; x >= minX + DASHED / 2; x -= DASHED) {
    if (x - DASHED / 2 < maxX - DASHED_THICKNESS) {
      g.moveTo(clamp(x - DASHED / 2, minX, maxX - DASHED_THICKNESS), maxY - DASHED_THICKNESS);
      g.lineTo(clamp(x, minX, maxX), maxY - DASHED_THICKNESS);
    }
    wrapAmount = minX - x - DASHED / 2;
  }

  // draw left line
  for (let y = maxY - wrapAmount; y >= minY + DASHED / 2; y -= DASHED) {
    g.moveTo(minX + DASHED_THICKNESS, clamp(y - DASHED / 2, minY, maxY));
    g.lineTo(minX + DASHED_THICKNESS, clamp(y, minY, maxY));
  }
}
