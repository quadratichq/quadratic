//! Handles drawing of checkbox and dropdown sprites.

import { Sprite, Texture } from 'pixi.js';

const CHECKBOX_SIZE = 15;
const DROPDOWN_SIZE = [8, 6];
const DROPDOWN_PADDING = [5, 8];

export const drawCheckbox = (x: number, y: number, checked: boolean) => {
  const sprite = new Sprite(Texture.from(`/images/checkbox${checked ? '-checked' : ''}.png`));
  sprite.width = sprite.height = CHECKBOX_SIZE;
  sprite.anchor.set(0.5);
  sprite.position.set(x, y);
  return sprite;
};

export const drawDropdown = (x: number, y: number) => {
  const sprite = new Sprite(Texture.from('/images/dropdown.png'));
  sprite.width = DROPDOWN_SIZE[0];
  sprite.height = DROPDOWN_SIZE[1];
  sprite.alpha = 0.5;
  sprite.anchor.set(1, 0);
  sprite.position.set(x - DROPDOWN_PADDING[0], y + DROPDOWN_PADDING[1]);
  return sprite;
};
