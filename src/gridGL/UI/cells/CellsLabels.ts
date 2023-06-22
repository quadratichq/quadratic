import { Container, Point, Rectangle } from 'pixi.js';
import { Coordinate } from '../../types/size';
import { CellLabel } from './CellLabel';
import { Bounds } from '../../../grid/sheet/Bounds';
import { CellFormat, CellAlignment } from '../../../schemas';
import { PixiApp } from '../../pixiApp/PixiApp';

export interface LabelData {
  text: string;
  originalText: string;
  x: number;
  y: number;
  location: Coordinate;
  isQuadrant?: boolean;
  expectedWidth: number;
  format?: CellFormat;
  alignment?: CellAlignment;
}

export class CellsLabels extends Container {
  private app: PixiApp;
  private labelData: LabelData[] = [];

  constructor(app: PixiApp) {
    super();
    this.app = app;
  }

  clear() {
    this.labelData = [];
    this.children.forEach((child) => (child.visible = false));
  }

  add(label: LabelData): void {
    this.labelData.push(label);
  }

  private getClipRight(label: CellLabel, textWidth: number): number | undefined {
    const rightEnd = label.x + textWidth;
    let column = label.data.location.x + 1;
    const row = label.data.location.y;
    let neighborOffset = this.app.sheet.gridOffsets.getCell(column, row).x;
    while (neighborOffset < rightEnd) {
      const cell = this.app.sheet.grid.get(column, row)?.cell;
      if (cell?.value || (cell?.evaluation_result && cell?.evaluation_result?.success === false)) {
        return neighborOffset;
      }
      const neighborWidth = this.app.sheet.gridOffsets.getColumnWidth(column);
      neighborOffset += neighborWidth;
      column++;
    }
  }

  private getClipLeft(label: CellLabel): number | undefined {
    const leftEnd = label.x;
    let column = label.data.location.x - 1;
    const row = label.data.location.y;
    let neighbor = this.app.sheet.gridOffsets.getCell(column, row);
    let neighborWidth = neighbor.width;
    let neighborOffset = neighbor.x + neighbor.width;
    while (neighborOffset > leftEnd) {
      const cell = this.app.sheet.grid.get(column, row)?.cell;
      if (cell?.value || (cell?.evaluation_result && cell?.evaluation_result?.success === false)) {
        return neighborOffset;
      }
      neighborOffset -= neighborWidth;
      column--;
      neighborWidth = this.app.sheet.gridOffsets.getColumnWidth(column);
    }
  }

  // checks to see if the label needs to be clipped based on other labels
  private checkForClipping(label: CellLabel): void {
    const data = label.data;
    if (!data) {
      throw new Error('Expected label.data to be defined in checkForClipping');
    }
    const textWidth = label.getFullTextWidth();
    if (textWidth > data.expectedWidth) {
      let clipLeft: number | undefined, clipRight: number | undefined;
      if (data.alignment === 'right') {
        clipLeft = this.getClipLeft(label);
      } else if (data.alignment === 'center') {
        clipLeft = this.getClipLeft(label);
        clipRight = this.getClipRight(label, textWidth);
      } else {
        clipRight = this.getClipRight(label, textWidth);
      }
      label.setClip({ clipLeft, clipRight });
    } else {
      label.setClip();
    }
  }

  private checkForOverflow(options: { label: CellLabel; bounds: Bounds }): void {
    const { label, bounds } = options;
    const { data } = label;
    const { alignment } = data;

    // track overflowed widths
    const width = label.textWidth;

    if (width > data.expectedWidth) {
      if (alignment === 'left' && !label.clipRight) {
        label.overflowRight = width - data.expectedWidth;
        label.overflowLeft = undefined;
      } else if (alignment === 'right' && !label.clipLeft) {
        label.overflowLeft = width - data.expectedWidth;
        label.overflowRight = undefined;
      } else if (alignment === 'center') {
        const overflow = (width - data.expectedWidth) / 2;
        if (!label.clipLeft) {
          label.overflowLeft = overflow;
        }
        if (!label.clipRight) {
          label.overflowRight = overflow;
        }
      }
    } else {
      label.overflowRight = undefined;
      label.overflowLeft = undefined;
    }
    bounds.addRectangle(new Rectangle(label.x, label.y, width, label.height));
  }

  private compareLabelData(label: CellLabel, data: LabelData): boolean {
    const isSame = (a?: boolean, b?: boolean): boolean => {
      return (!a && !b) || (a && b) ? true : false;
    };

    if (
      label.data?.text !== data.text ||
      !isSame(label.data?.format?.bold, data.format?.bold) ||
      !isSame(label.data?.format?.italic, data.format?.italic) ||
      label.data?.format?.textColor !== data.format?.textColor
    )
      return false;

    const position = this.calculatePosition(label, data);
    if (!label.lastPosition || !label.lastPosition.equals(position)) return false;

    return true;
  }

  private calculatePosition(label: CellLabel, data: LabelData): Point {
    data.alignment = 'left';
    if (data.format?.alignment === 'right') data.alignment = 'right';
    else if (data.format?.alignment === 'center') data.alignment = 'center';
    else if (data.format?.alignment === 'left') data.alignment = 'left';
    if (data.alignment === 'right') {
      return new Point(data.x + data.expectedWidth - label.textWidth, data.y);
    } else if (data.alignment === 'center') {
      return new Point(data.x + data.expectedWidth / 2 - label.textWidth / 2, data.y);
    }
    return new Point(data.x, data.y);
  }

  private updateLabel(label: CellLabel, data: LabelData): void {
    label.update(data);
    label.visible = true;

    label.position = this.calculatePosition(label, data);

    // this ensures that the text is redrawn during column resize (otherwise clipping will not work properly)
    if (!label.lastPosition || !label.lastPosition.equals(label.position)) {
      label.dirty = true;
      label.lastPosition = label.position.clone();
    }
  }

  /**
   * add labels to headings using cached labels
   * @returns the visual bounds only if isQuadrant is defined (otherwise not worth the .width/.height call)
   */
  update(): Rectangle | undefined {
    const bounds = new Bounds();

    // keep current children to use as the cache
    this.children.forEach((child) => (child.visible = false));

    const available = [...this.children] as CellLabel[];
    const leftovers: LabelData[] = [];

    // reuse existing labels that have the same text
    this.labelData.forEach((data) => {
      const index = available.findIndex((label) => this.compareLabelData(label, data));
      if (index === -1) {
        leftovers.push(data);
      } else {
        this.updateLabel(available[index], data);
        available.splice(index, 1);
      }
    });

    // use existing labels but change the text
    leftovers.forEach((data, i) => {
      if (i < available.length) {
        this.updateLabel(available[i], data);
      }

      // otherwise create new labels
      else {
        const label = this.addChild(new CellLabel(data));
        label.position = this.calculatePosition(label, data);
        label.lastPosition = label.position.clone();
      }
    });

    this.children.forEach((child) => {
      const label = child as CellLabel;
      if (label.visible) {
        this.checkForClipping(label);
        this.checkForOverflow({ label, bounds });
      }
    });

    if (!bounds.empty) {
      return bounds.toRectangle();
    }
  }

  get(): CellLabel[] {
    return this.children as CellLabel[];
  }

  getVisible(): CellLabel[] {
    return this.children.filter((child) => child.visible) as CellLabel[];
  }
}
