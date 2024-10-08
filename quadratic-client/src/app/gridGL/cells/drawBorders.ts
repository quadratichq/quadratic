import { CellBorderLine, Rgba } from '@/app/quadratic-core-types';
import { Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import { colors } from '../../theme/colors';
import { generatedTextures } from '../generateTextures';

export interface BorderCull {
  sprite: Sprite | TilingSprite;
  rectangle: Rectangle;
}

export const borderLineWidth = 1;

export function setBorderTexture(
  sprite: Sprite | TilingSprite,
  horizontal: boolean,
  borderLine?: CellBorderLine
): void {
  if (borderLine === 'dashed') {
    sprite.texture = horizontal ? generatedTextures.dashedHorizontal : generatedTextures.dashedVertical;
  } else if (borderLine === 'dotted') {
    sprite.texture = horizontal ? generatedTextures.dottedHorizontal : generatedTextures.dottedVertical;
  } else {
    sprite.texture = Texture.WHITE;
  }
}

export function drawBorder(options: {
  x: number;
  y: number;
  width: number;
  height: number;
  tint: number;
  alpha: number;
  getSprite: (tiling?: boolean) => Sprite;
  top?: boolean;
  left?: boolean;
  bottom?: boolean;
  right?: boolean;
  borderType?: CellBorderLine;
}): BorderCull[] {
  const borderLines: BorderCull[] = [];
  const { borderType } = options;
  const lineWidth = borderType === 'line2' ? 2 : borderType === 'line3' ? 3 : 1;

  const tiling = borderType === 'dashed' || borderType === 'dotted';
  const doubleDistance = borderType === 'double' ? lineWidth * 2 : 0;

  if (options.top) {
    const top = options.getSprite(tiling);
    setBorderTexture(top, true, borderType);
    top.tint = options.tint;
    top.alpha = options.alpha;
    top.width = options.width + lineWidth;
    top.height = lineWidth;
    top.position.set(options.x - lineWidth / 2, options.y - lineWidth / 2);

    if (doubleDistance) {
      const top = options.getSprite(tiling);
      setBorderTexture(top, true, borderType);
      top.tint = options.tint;
      top.alpha = options.alpha;
      top.width = options.width + lineWidth - ((options.left ? 1 : 0) + (options.right ? 1 : 0)) * doubleDistance;
      top.height = lineWidth;
      top.position.set(
        options.x - lineWidth / 2 + (options.left ? doubleDistance : 0),
        options.y + doubleDistance - lineWidth / 2
      );
    }
  }

  if (options.bottom) {
    const bottom = options.getSprite(tiling);
    setBorderTexture(bottom, true, borderType);
    bottom.tint = options.tint;
    bottom.alpha = options.alpha;
    const width = options.width + (options.right ? 0 : lineWidth);
    bottom.width = width;
    bottom.height = lineWidth;
    bottom.position.set(options.x - lineWidth / 2, options.y + options.height - lineWidth / 2);
    borderLines.push({
      sprite: bottom,
      rectangle: new Rectangle(bottom.x, bottom.y, width, lineWidth),
    });

    if (doubleDistance) {
      const bottom = options.getSprite(tiling);
      setBorderTexture(bottom, true, borderType);
      bottom.tint = options.tint;
      bottom.alpha = options.alpha;
      const width = options.width + lineWidth - ((options.left ? 1 : 0) + (options.right ? 1 : 0)) * doubleDistance;
      bottom.width = width;
      bottom.height = lineWidth;
      bottom.position.set(
        options.x - lineWidth / 2 + (options.left ? doubleDistance : 0),
        options.y - doubleDistance + options.height - lineWidth / 2
      );
      borderLines.push({
        sprite: bottom,
        rectangle: new Rectangle(bottom.x, bottom.y, width, lineWidth),
      });
    }
  }

  if (options.left) {
    const left = options.getSprite(tiling);
    setBorderTexture(left, false, borderType);
    left.tint = options.tint;
    left.alpha = options.alpha;
    left.width = lineWidth;
    const height = options.height + (options.top ? 0 : lineWidth) - (options.bottom ? lineWidth : 0);
    left.height = height;
    left.position.set(options.x - lineWidth / 2, options.y - lineWidth / 2 + (options.top ? lineWidth : 0));
    borderLines.push({
      sprite: left,
      rectangle: new Rectangle(left.x, left.y, lineWidth, height),
    });
    if (doubleDistance) {
      const left = options.getSprite(tiling);
      setBorderTexture(left, false, borderType);
      left.tint = options.tint;
      left.alpha = options.alpha;
      left.width = lineWidth;
      const height = options.height + lineWidth - ((options.top ? 1 : 0) + (options.bottom ? 1 : 0)) * doubleDistance;
      left.height = height;
      left.position.set(
        options.x - lineWidth / 2 + doubleDistance,
        options.y - lineWidth / 2 + (options.top ? doubleDistance : 0)
      );
      borderLines.push({
        sprite: left,
        rectangle: new Rectangle(left.x, left.y, lineWidth, height),
      });
    }
  }

  if (options.right) {
    const right = options.getSprite(tiling);
    setBorderTexture(right, false, borderType);
    right.tint = options.tint;
    right.alpha = options.alpha;
    right.width = lineWidth;
    const height = options.height + (options.top ? 0 : lineWidth);
    right.height = height;
    right.position.set(
      options.x + options.width - lineWidth / 2,
      options.y - lineWidth / 2 + (options.top ? lineWidth : 0)
    );
    borderLines.push({
      sprite: right,
      rectangle: new Rectangle(right.x, right.y, lineWidth, height),
    });

    if (doubleDistance) {
      const right = options.getSprite(tiling);
      setBorderTexture(right, false, borderType);
      right.tint = options.tint;
      right.alpha = options.alpha;
      right.width = lineWidth;
      const height = options.height + lineWidth - ((options.top ? 1 : 0) + (options.bottom ? 1 : 0)) * doubleDistance;
      right.height = height;
      right.position.set(
        options.x + options.width - lineWidth / 2 - doubleDistance,
        options.y - lineWidth / 2 + (options.bottom ? doubleDistance : 0)
      );
      borderLines.push({
        sprite: right,
        rectangle: new Rectangle(right.x, right.y, lineWidth, height),
      });
    }
  }
  return borderLines;
}

export function drawLine(options: {
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
  tint: number;
  getSprite: (tiling?: boolean) => Sprite;
}): BorderCull {
  const line = options.getSprite(false);
  line.tint = options.tint;
  line.alpha = options.alpha;
  line.width = options.width;
  line.height = options.height;
  line.position.set(options.x, options.y);
  return {
    sprite: line,
    rectangle: new Rectangle(line.x, line.y, options.width, options.height),
  };
}

const convertColor = (rgb: Rgba): number => {
  return (rgb.red << 16) | (rgb.green << 8) | rgb.blue;
};

export function drawCellBorder(options: {
  position: Rectangle;
  horizontal?: { type: CellBorderLine; color?: Rgba };
  vertical?: { type: CellBorderLine; color?: Rgba };
  getSprite: (tiling?: boolean) => Sprite;
}): BorderCull[] {
  const { position, getSprite, horizontal, vertical } = options;
  const borderCull: BorderCull[] = [];
  if (horizontal) {
    const borderType = horizontal.type;
    const lineWidth = borderType === 'line2' ? 2 : borderType === 'line3' ? 3 : 1;
    const tiling = borderType === 'dashed' || borderType === 'dotted';
    const doubleDistance = borderType === 'double' ? lineWidth * 2 : 0;

    const top = getSprite(tiling);
    setBorderTexture(top, true, borderType);
    const color = horizontal.color ? convertColor(horizontal.color) : colors.defaultBorderColor;
    top.tint = color;
    top.alpha = horizontal.color ? horizontal.color.alpha : 1;
    top.width = position.width + lineWidth;
    top.height = lineWidth;
    top.position.set(position.x - lineWidth / 2, position.y - lineWidth / 2);
    borderCull.push({
      sprite: top,
      rectangle: new Rectangle(top.x, top.y, top.width, top.height),
    });
    if (doubleDistance) {
      const top = getSprite(tiling);
      setBorderTexture(top, true, borderType);
      top.tint = color;
      top.width = position.width + lineWidth; // todo - ((options.left ? 1 : 0) + (options.right ? 1 : 0)) * doubleDistance;
      top.height = lineWidth;
      top.position.set(
        position.x - lineWidth / 2, // todo + (options.left ? doubleDistance : 0),
        position.y + doubleDistance - lineWidth / 2
      );
      borderCull.push({
        sprite: top,
        rectangle: new Rectangle(top.x, top.y, top.width, top.height),
      });
    }
  }

  if (vertical) {
    const borderType = vertical.type;
    const lineWidth = borderType === 'line2' ? 2 : borderType === 'line3' ? 3 : 1;
    const tiling = borderType === 'dashed' || borderType === 'dotted';
    const doubleDistance = borderType === 'double' ? lineWidth * 2 : 0;

    const left = options.getSprite(tiling);
    setBorderTexture(left, false, borderType);
    const color = vertical.color ? convertColor(vertical.color) : colors.defaultBorderColor;
    left.tint = color;
    left.alpha = vertical.color ? vertical.color.alpha : 1;
    left.width = lineWidth;
    left.height = position.height + lineWidth;
    left.position.set(position.x - lineWidth / 2, position.y - lineWidth / 2);
    borderCull.push({
      sprite: left,
      rectangle: new Rectangle(left.x, left.y, left.width, left.height),
    });

    if (doubleDistance) {
      const left = options.getSprite(tiling);
      setBorderTexture(left, false, borderType);
      left.tint = color;
      left.width = lineWidth;
      left.height = position.height + lineWidth; // todo - ((options.top ? 1 : 0) + (options.bottom ? 1 : 0)) * doubleDistance;
      left.position.set(
        position.x - lineWidth / 2 + doubleDistance,
        position.y - lineWidth / 2 // todo + (options.top ? doubleDistance : 0)
      );
      borderCull.push({
        sprite: left,
        rectangle: new Rectangle(left.x, left.y, left.width, left.height),
      });
    }
  }
  return borderCull;
}
