import { JsCoordinate } from '@/app/quadratic-core-types';
import { Rectangle } from 'pixi.js';

export interface Link {
  pos: JsCoordinate;
  textRectangle: Rectangle;
}
