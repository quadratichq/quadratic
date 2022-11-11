import { Sprite } from 'pixi.js';

export function drawBorder(options: {
  x: number;
  y: number;
  width: number;
  height: number;
  tint: number;
  alpha: number;
  getSprite: () => Sprite;
  top?: boolean;
  left?: boolean;
  bottom?: boolean;
  right?: boolean;
  lineWidth?: number;
}) {
  const lineWidth = options.lineWidth ?? 1;
  if (options.top) {
    const top = options.getSprite();
    top.tint = options.tint;
    top.alpha = options.alpha;
    top.width = options.width;
    top.height = lineWidth;
    top.position.set(options.x, options.y);
  }

  if (options.bottom) {
    const bottom = options.getSprite();
    bottom.tint = options.tint;
    bottom.alpha = options.alpha;
    bottom.width = options.width;
    bottom.height = lineWidth;
    bottom.position.set(options.x, options.y + options.height - lineWidth);
  }

  if (options.left) {
    const left = options.getSprite();
    left.tint = options.tint;
    left.alpha = options.alpha;
    left.width = lineWidth;
    left.height = options.height;
    left.position.set(options.x, options.y);
  }

  if (options.right) {
    const right = options.getSprite();
    right.tint = options.tint;
    right.alpha = options.alpha;
    right.width = lineWidth;
    right.height = options.height;
    right.position.set(options.x + options.width - lineWidth, options.y);
  }
}