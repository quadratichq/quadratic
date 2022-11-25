import { Sprite, Texture, TilingSprite } from 'pixi.js';
import { BorderType } from '../../../gridDB/db';
import { dashedTextures } from '../../dashedTextures';

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
  borderType?: BorderType;
}) {
  const { borderType } = options;
  const lineWidth = borderType === BorderType.line2 ? 2 : borderType === BorderType.line3 ? 3 : 1;

  const tiling = borderType === BorderType.dashed || borderType === BorderType.dotted;
  const doubleDistance = borderType === BorderType.double ? lineWidth * 2 : 0;

  const setTexture = (sprite: Sprite | TilingSprite, horizontal: boolean): void => {
    if (borderType === BorderType.dashed) {
      sprite.texture = horizontal ? dashedTextures.dashedHorizontal : dashedTextures.dashedVertical;
    } else if (borderType === BorderType.dotted) {
      sprite.texture = horizontal ? dashedTextures.dottedHorizontal : dashedTextures.dottedVertical;
    } else {
      sprite.texture = Texture.WHITE;
    }
  };

  if (options.top) {
    const top = options.getSprite(tiling);
    setTexture(top, true);
    top.tint = options.tint;
    top.alpha = options.alpha;
    top.width = options.width + lineWidth;
    top.height = lineWidth;
    top.position.set(options.x - lineWidth / 2, options.y - lineWidth / 2);

    if (doubleDistance) {
      const top = options.getSprite(tiling);
      setTexture(top, true);
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
    setTexture(bottom, true);
    bottom.tint = options.tint;
    bottom.alpha = options.alpha;
    bottom.width = options.width + lineWidth;
    bottom.height = lineWidth;
    bottom.position.set(options.x - lineWidth / 2, options.y + options.height - lineWidth / 2);

    if (doubleDistance) {
      const bottom = options.getSprite(tiling);
      setTexture(bottom, true);
      bottom.tint = options.tint;
      bottom.alpha = options.alpha;
      bottom.width = options.width + lineWidth - ((options.left ? 1 : 0) + (options.right ? 1 : 0)) * doubleDistance;
      bottom.height = lineWidth;
      bottom.position.set(
        options.x - lineWidth / 2 + (options.left ? doubleDistance : 0),
        options.y - doubleDistance + options.height - lineWidth / 2
      );
    }
  }

  if (options.left) {
    const left = options.getSprite(tiling);
    setTexture(left, false);
    left.tint = options.tint;
    left.alpha = options.alpha;
    left.width = lineWidth;
    left.height = options.height + lineWidth;
    left.position.set(options.x - lineWidth / 2, options.y - lineWidth / 2);

    if (doubleDistance) {
      const left = options.getSprite(tiling);
      setTexture(left, false);
      left.tint = options.tint;
      left.alpha = options.alpha;
      left.width = lineWidth;
      left.height = options.height + lineWidth - ((options.top ? 1 : 0) + (options.bottom ? 1 : 0)) * doubleDistance;
      left.position.set(
        options.x - lineWidth / 2 + doubleDistance,
        options.y - lineWidth / 2 + (options.top ? doubleDistance : 0)
      );
    }
  }

  if (options.right) {
    const right = options.getSprite(tiling);
    setTexture(right, false);
    right.tint = options.tint;
    right.alpha = options.alpha;
    right.width = lineWidth;
    right.height = options.height + lineWidth;
    right.position.set(options.x + options.width - lineWidth / 2, options.y - lineWidth / 2);

    if (doubleDistance) {
      const right = options.getSprite(tiling);
      setTexture(right, false);
      right.tint = options.tint;
      right.alpha = options.alpha;
      right.width = lineWidth;
      right.height = options.height + lineWidth - ((options.top ? 1 : 0) + (options.bottom ? 1 : 0)) * doubleDistance;
      right.position.set(
        options.x + options.width - lineWidth / 2 - doubleDistance,
        options.y - lineWidth / 2 + (options.bottom ? doubleDistance : 0)
      );
    }
  }
}
