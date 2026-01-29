//! Handles drawing of checkbox and dropdown sprites.

import { emojis, SCALE_EMOJI } from '@/app/gridGL/pixiApp/emojis/emojis';
import type {
  RenderCheckbox,
  RenderDropdown,
  RenderEmoji,
} from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHashSpecial';
import { Assets, MIPMAP_MODES, Rectangle, Sprite, Texture } from 'pixi.js';
import { CHECKBOX_SIZE, DROPDOWN_PADDING, DROPDOWN_SIZE } from './drawSpecialConstants';

export { CHECKBOX_SIZE, DROPDOWN_PADDING, DROPDOWN_SIZE };

export interface SpecialSprite extends Sprite {
  column: number;
  row: number;
  type: 'checkbox' | 'dropdown' | 'emoji';

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
  const dropdownIconTexture = Assets.get('dropdown-icon');
  const sprite = new Sprite(dropdownIconTexture) as SpecialSprite;
  sprite.column = options.column;
  sprite.row = options.row;
  sprite.type = 'dropdown';
  sprite.width = DROPDOWN_SIZE[0];
  sprite.height = DROPDOWN_SIZE[1];
  sprite.rectangle = dropdownRectangle(options.x, options.y);
  sprite.alpha = 0.5;
  // Position sprite so its right edge is inset from options.x (which is rectangle.right) by DROPDOWN_PADDING[0]
  sprite.position.set(options.x - DROPDOWN_SIZE[0] - DROPDOWN_PADDING[0], options.y + DROPDOWN_PADDING[1]);
  return sprite;
};

export const drawEmoji = (options: RenderEmoji): SpecialSprite | undefined => {
  const texture = emojis.getCharacter(options.emoji);
  if (!texture) {
    // Emoji not in spritesheet - skip rendering
    return undefined;
  }

  const sprite = new Sprite(texture) as SpecialSprite;
  sprite.column = -1;
  sprite.row = -1;
  sprite.type = 'emoji';
  // Scale up to compensate for SCALE_EMOJI padding in spritesheet textures
  // The emoji in the texture is SCALE_EMOJI size of the cell, so we scale up by 1/SCALE_EMOJI
  sprite.width = options.width / SCALE_EMOJI;
  sprite.height = options.height / SCALE_EMOJI;
  sprite.rectangle = new Rectangle(-1, -1, 0, 0);
  sprite.position.set(options.x, options.y);
  sprite.anchor.set(0.5);
  return sprite;
};
