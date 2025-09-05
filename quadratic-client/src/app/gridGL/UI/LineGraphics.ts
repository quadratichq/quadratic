//! Line graphics class that uses sprites instead of PIXI.Graphics to draw
//! simple shapes (axis lines and rects). This is necessary because
//! PIXI.Graphics does not properly support very large offsets (> 300m).

import { Container, Sprite, Texture } from 'pixi.js';

interface DrawRectOptions {
  fill?: number;
  alpha?: number;
  strokeWidth?: number;
  strokeTint?: number;
  strokeAlpha?: number;

  // 1 / viewport.scaled
  scaled?: number;
}

interface DrawLineOptions {
  tint?: number;
  alpha?: number;
  alignment?: number;
  strokeWidth?: number;

  // 1 / viewport.scaled
  scaled?: number;
}

export class LineGraphics extends Container {
  private current = 0;

  private getSprite(): Sprite {
    if (this.current >= this.children.length) {
      const sprite = this.addChild(new Sprite(Texture.WHITE));
      return sprite;
    } else {
      const sprite = this.children[this.current] as Sprite;
      sprite.visible = true;
      this.current++;
      return sprite;
    }
  }

  clear() {
    this.current = 0;
  }

  finish() {
    for (let i = this.current; i < this.children.length; i++) {
      this.children[i].visible = false;
    }
  }

  drawRect(x0: number, y0: number, x1: number, y1: number, options: DrawRectOptions = {}) {
    const { fill, alpha, strokeTint, strokeAlpha, scaled } = options;
    let strokeWidth = (options.strokeWidth ?? 1) * (scaled ?? 1);
    const sprite = this.getSprite();
    this.drawHorizontalLine(x0, x1 - strokeWidth, y0, { tint: strokeTint, alpha: strokeAlpha, strokeWidth });
    if (strokeWidth !== undefined) {
      sprite.position.set(x0 + strokeWidth, y0 + strokeWidth);
      sprite.width = x1 - x0 - strokeWidth * 2;
      sprite.height = y1 - y0 - strokeWidth * 2;
      sprite.tint = fill ?? 0;
      sprite.alpha = alpha ?? 1;
    } else {
      sprite.position.set(x0, y0);
      sprite.width = x1 - x0;
      sprite.height = y1 - y0;
      sprite.tint = fill ?? 0;
      sprite.alpha = alpha ?? 1;
    }
  }

  drawHorizontalLine(x0: number, x1: number, y: number, options: DrawLineOptions = {}) {
    const { tint, alpha, scaled } = options;
    let alignment = options.alignment ?? 0.5;
    let strokeWidth = (options.strokeWidth ?? 1) * (scaled ?? 1);
    const sprite = this.getSprite();
    sprite.position.set(x0, y - alignment * strokeWidth);
    sprite.width = x1 - x0;
    sprite.height = strokeWidth;
    sprite.tint = tint ?? 0;
    sprite.alpha = alpha ?? 1;
  }

  drawVerticalLine(y0: number, y1: number, x: number, options: DrawLineOptions = {}) {
    const { tint, alpha, scaled } = options;
    let alignment = options.alignment ?? 0.5;
    let strokeWidth = (options.strokeWidth ?? 1) * (scaled ?? 1);
    const sprite = this.getSprite();
    sprite.position.set(x, y0 - alignment * strokeWidth);
    sprite.width = 1;
    sprite.height = y1 - y0;
    sprite.tint = tint ?? 0;
    sprite.alpha = alpha ?? 1;
  }
}
