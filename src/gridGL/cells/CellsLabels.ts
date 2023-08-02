import { Point, Rectangle } from 'pixi.js';
import { Bounds } from '../../grid/sheet/Bounds';
import { SheetRust } from '../../grid/sheet/SheetRust';
import { ContainerBitmapText } from '../pixiOverride/ContainerBitmapText';
import { CellLabel } from './CellLabel';
import { CellsHash } from './CellsHash';
import { CellHash, CellRust, CellsHashBounds } from './CellsTypes';

// running around 30ms w/normal container

// holds all CellLabels within a sheet
export class CellsLabels extends ContainerBitmapText implements CellHash {
  private sheet: SheetRust;

  AABB?: Rectangle;
  hashes: Set<CellsHash>;
  oldBounds?: CellsHashBounds;

  constructor(sheet: SheetRust) {
    super();
    this.sheet = sheet;
    this.hashes = new Set();
  }

  add(cells: CellRust[]): CellLabel[] {
    return cells.map((cell) => {
      const rectangle = this.sheet.gridOffsets.getCell(cell.x, cell.y);
      const cellLabel = this.addLabel(new CellLabel(cell, rectangle));
      return cellLabel;
    });
  }

  private getClipRight(label: CellLabel, textWidth: number): number | undefined {
    // const rightEnd = label.x + textWidth;
    // let column = label.data.location.x + 1;
    // const row = label.data.location.y;
    // let neighborOffset = this.sheet.gridOffsets.getCell(column, row).x;
    // while (neighborOffset < rightEnd) {
    //   const cell = this.sheet.grid.get(column, row)?.cell;
    //   if (cell?.value || (cell?.evaluation_result && cell?.evaluation_result?.success === false)) {
    //     return neighborOffset;
    //   }
    //   const neighborWidth = this.sheet.gridOffsets.getColumnWidth(column);
    //   neighborOffset += neighborWidth;
    //   column++;
    // }
    return;
  }

  private getClipLeft(label: CellLabel): number | undefined {
    // const leftEnd = label.x;
    // let column = label.data.location.x - 1;
    // const row = label.data.location.y;
    // let neighbor = this.app.sheet.gridOffsets.getCell(column, row);
    // let neighborWidth = neighbor.width;
    // let neighborOffset = neighbor.x + neighbor.width;
    // while (neighborOffset > leftEnd) {
    //   const cell = this.app.sheet.grid.get(column, row)?.cell;
    //   if (cell?.value || (cell?.evaluation_result && cell?.evaluation_result?.success === false)) {
    //     return neighborOffset;
    //   }
    //   neighborOffset -= neighborWidth;
    //   column--;
    //   neighborWidth = this.app.sheet.gridOffsets.getColumnWidth(column);
    // }
    return;
  }

  // checks to see if the label needs to be clipped based on other labels
  private checkForClipping(label: CellLabel): void {
    // const data = label.data;
    // if (!data) {
    //   throw new Error('Expected label.data to be defined in checkForClipping');
    // }
    // const textWidth = label.getFullTextWidth();
    // if (textWidth > data.expectedWidth) {
    //   let clipLeft: number | undefined, clipRight: number | undefined;
    //   if (data.alignment === 'right') {
    //     clipLeft = this.getClipLeft(label);
    //   } else if (data.alignment === 'center') {
    //     clipLeft = this.getClipLeft(label);
    //     clipRight = this.getClipRight(label, textWidth);
    //   } else {
    //     clipRight = this.getClipRight(label, textWidth);
    //   }
    //   label.setClip({ clipLeft, clipRight });
    // } else {
    //   label.setClip();
    // }
  }

  private checkForOverflow(options: { label: CellLabel; bounds: Bounds }): void {
    // const { label, bounds } = options;
    // const { data } = label;
    // const { alignment } = data;
    // // track overflowed widths
    // const width = label.textWidth;
    // if (width > data.expectedWidth) {
    //   if (alignment === 'left' && !label.clipRight) {
    //     label.overflowRight = width - data.expectedWidth;
    //     label.overflowLeft = undefined;
    //   } else if (alignment === 'right' && !label.clipLeft) {
    //     label.overflowLeft = width - data.expectedWidth;
    //     label.overflowRight = undefined;
    //   } else if (alignment === 'center') {
    //     const overflow = (width - data.expectedWidth) / 2;
    //     if (!label.clipLeft) {
    //       label.overflowLeft = overflow;
    //     }
    //     if (!label.clipRight) {
    //       label.overflowRight = overflow;
    //     }
    //   }
    // } else {
    //   label.overflowRight = undefined;
    //   label.overflowLeft = undefined;
    // }
    // bounds.addRectangle(new Rectangle(label.x, label.y, width, label.height));
  }

  // todo: update AABB based on position
  private calculatePosition(label: CellLabel): Point {
    let alignment = label.alignment ?? 'left';
    if (alignment === 'right') {
      return new Point(label.topLeft.x + label.right - label.textWidth, label.topLeft.y);
    } else if (alignment === 'center') {
      return new Point(label.topLeft.x + label.right / 2 - label.textWidth / 2, label.topLeft.y);
    }
    return label.topLeft;
  }

  private updateLabel(label: CellLabel): void {
    label.visible = true;

    label.position = this.calculatePosition(label);

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
  // update(): Rectangle | undefined {
  //   const bounds = new Bounds();

  //   // keep current children to use as the cache
  //   this.children.forEach((child) => (child.visible = false));

  //   const available = [...this.children] as CellLabel[];
  //   const leftovers: LabelData[] = [];

  //   // reuse existing labels that have the same text
  //   this.labelData.forEach((data) => {
  //     const index = available.findIndex((label) => this.compareLabelData(label, data));
  //     if (index === -1) {
  //       leftovers.push(data);
  //     } else {
  //       this.updateLabel(available[index], data);
  //       available.splice(index, 1);
  //     }
  //   });

  //   // use existing labels but change the text
  //   leftovers.forEach((data, i) => {
  //     if (i < available.length) {
  //       this.updateLabel(available[i], data);
  //     }

  //     // otherwise create new labels
  //     else {
  //       const label = this.addChild(new CellLabel(data));
  //       label.position = this.calculatePosition(label, data);
  //       label.lastPosition = label.position.clone();
  //     }
  //   });

  //   this.children.forEach((child) => {
  //     const label = child as CellLabel;
  //     if (label.visible) {
  //       this.checkForClipping(label);
  //       this.checkForOverflow({ label, bounds });
  //     }
  //   });

  //   if (!bounds.empty) {
  //     return bounds.toRectangle();
  //   }
  // }

  // todo: this is probably also not interesting
  get(): CellLabel[] {
    return this.cellLabels;
  }

  // todo: this is not interesting
  getVisible(): CellLabel[] {
    return this.cellLabels.filter((child) => child.visible) as CellLabel[];
  }
}
