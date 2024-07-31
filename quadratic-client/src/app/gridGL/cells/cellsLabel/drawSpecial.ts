//! Handles drawing of checkbox and dropdown sprites.

import type {
  RenderCheckbox,
  RenderDropdown,
} from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHashSpecial';
import { Rectangle, Sprite, Texture } from 'pixi.js';

const CHECKBOX_SIZE = 15;
const DROPDOWN_SIZE = [8, 6];
const DROPDOWN_PADDING = [5, 8];

export interface SpecialSprite extends Sprite {
  column: number;
  row: number;
  type: 'checkbox' | 'dropdown';

  checkbox?: boolean;

  // cheap bounds
  rectangle: Rectangle;
}

export const drawCheckbox = (options: RenderCheckbox) => {
  const sprite = new Sprite(Texture.from(`/images/checkbox${options.value ? '-checked' : ''}.png`)) as SpecialSprite;
  sprite.checkbox = options.value;
  sprite.column = options.column;
  sprite.row = options.row;
  sprite.type = 'checkbox';
  sprite.width = sprite.height = CHECKBOX_SIZE;
  sprite.rectangle = new Rectangle(
    options.x - CHECKBOX_SIZE / 2,
    options.y - CHECKBOX_SIZE / 2,
    CHECKBOX_SIZE,
    CHECKBOX_SIZE
  );
  sprite.anchor.set(0.5);
  sprite.position.set(options.x, options.y);
  return sprite;
};

export const drawDropdown = (options: RenderDropdown) => {
  const sprite = new Sprite(Texture.from('/images/dropdown.png')) as SpecialSprite;
  sprite.column = options.column;
  sprite.row = options.row;
  sprite.type = 'dropdown';
  sprite.width = DROPDOWN_SIZE[0];
  sprite.height = DROPDOWN_SIZE[1];
  sprite.rectangle = new Rectangle(options.x - DROPDOWN_PADDING[0], options.y, DROPDOWN_SIZE[0], DROPDOWN_SIZE[1]);
  sprite.alpha = 0.5;
  sprite.anchor.set(1, 0);
  sprite.position.set(options.x - DROPDOWN_PADDING[0], options.y + DROPDOWN_PADDING[1]);
  return sprite;
};
