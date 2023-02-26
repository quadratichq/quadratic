import { Container } from 'pixi.js';
import { Coordinate } from '../types/size';
import { CellFormat } from '../../grid/sheet/gridTypes';
import { CellLabel } from './CellLabel';
import { QuadrantsSort } from './QuadrantsSort';

export class CellsLabel extends Container {
  private labels = new Map<string, CellLabel>();
  private quadrants = new QuadrantsSort<CellLabel>();
  private cache: CellLabel[] = [];

  /** removes all cell labels */
  empty(): void {
    this.labels.forEach((label: CellLabel) => this.cache.push(label));
    this.labels.clear();
    this.quadrants.empty();
  }

  /** hides all labels */
  private clear(): void {
    this.children.forEach((child) => (child.visible = false));
  }

  remove(location: Coordinate) {
    const key = `${location.x},${location.y}`;
    const label = this.labels.get(key);
    if (label) {
      this.removeChild(label);
      this.labels.delete(key);
      this.quadrants.remove(location);
    }
  }

  add(options: {
    text: string;
    x: number;
    y: number;
    location: Coordinate;
    width: number
    format?: CellFormat;
  }): void {
    const { text, x, y, location, format } = options;
    const key = `${location.x},${location.y}`;
    let label = this.labels.get(key);
    if (label) {
      if (label.text !== options.text) {
        label.text = text;
      }
      label.setFormat(format);
    } else {
      if (this.cache.length) {
        label = this.cache.pop() as CellLabel;
        label.text = text;
      } else {
        label = this.addChild(new CellLabel(text, location, format));
      }
      this.labels.set(key, label);
      this.quadrants.add(location, label);
    }
    label.position.set(x, y);
  }
}