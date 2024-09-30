import { Coordinate } from '@/app/gridGL/types/size';
import { Rectangle } from 'pixi.js';

export interface Link {
  pos: Coordinate;
  textRectangle: Rectangle;
}
