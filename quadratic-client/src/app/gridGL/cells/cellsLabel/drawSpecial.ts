//! Handles drawing of checkbox and dropdown sprites.

import type {
  RenderCheckbox,
  RenderDropdown,
} from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHashSpecial';
import { MIPMAP_MODES, Rectangle, Sprite, Texture } from 'pixi.js';

export const CHECKBOX_SIZE = 15;
export const DROPDOWN_SIZE = [8, 6];
export const DROPDOWN_PADDING = [5, 8];

export interface SpecialSprite extends Sprite {
  column: number;
  row: number;
  type: 'checkbox' | 'dropdown';

  checkbox?: boolean;

  // cheap bounds
  rectangle: Rectangle;
}

export const checkboxRectangle = (x: number, y: number): Rectangle => {
  return new Rectangle(x - CHECKBOX_SIZE / 2, y - CHECKBOX_SIZE / 2, CHECKBOX_SIZE, CHECKBOX_SIZE);
};

export const drawCheckbox = (options: RenderCheckbox) => {
  const texture = Texture.from(`/images/checkbox${options.value ? '-checked' : ''}.png`);

  // this ensures the sprite looks good when zooming all the way out (otherwise it flashes)
  texture.baseTexture.mipmap = MIPMAP_MODES.ON;

  const sprite = new Sprite(texture) as SpecialSprite;
  sprite.checkbox = options.value;
  sprite.column = options.column;
  sprite.row = options.row;
  sprite.type = 'checkbox';
  sprite.width = sprite.height = CHECKBOX_SIZE;
  sprite.rectangle = checkboxRectangle(options.x, options.y);
  sprite.anchor.set(0.5);
  sprite.position.set(options.x, options.y);
  return sprite;
};

export const dropdownRectangle = (x: number, y: number): Rectangle => {
  return new Rectangle(
    x - DROPDOWN_SIZE[0] - DROPDOWN_PADDING[0],
    y,
    DROPDOWN_SIZE[0] + DROPDOWN_PADDING[0] * 2,
    DROPDOWN_SIZE[1] + DROPDOWN_PADDING[1]
  );
};

export const drawDropdown = (options: RenderDropdown) => {
  const sprite = new Sprite(Texture.from('/images/dropdown.png')) as SpecialSprite;
  sprite.column = options.column;
  sprite.row = options.row;
  sprite.type = 'dropdown';
  sprite.width = DROPDOWN_SIZE[0];
  sprite.height = DROPDOWN_SIZE[1];
  sprite.rectangle = dropdownRectangle(options.x, options.y);
  sprite.alpha = 0.5;
  sprite.anchor.set(1, 0);
  sprite.position.set(options.x - DROPDOWN_PADDING[0], options.y + DROPDOWN_PADDING[1]);
  return sprite;
};
