import type { JsCoordinate } from '@/app/quadratic-core-types';
import type { Rectangle } from 'pixi.js';

export interface Link {
  pos: JsCoordinate;
  textRectangle: Rectangle;
}
