import { Container, Rectangle } from 'pixi.js';
import { Coordinate } from '../../types/size';
import { CellLabel } from './CellLabel';
import { CellAlignment, CellFormat } from '../../../grid/sheet/gridTypes';
import { Bounds } from '../../../grid/sheet/Bounds';

interface LabelData {
  text: string;
  x: number;
  y: number;
  location?: Coordinate;
  isQuadrant?: boolean;
  expectedWidth: number;
  format?: CellFormat;
}

export class CellsLabels extends Container {
  private labelData: LabelData[] = [];

  clear() {
    this.labelData = [];
    this.children.forEach((child) => (child.visible = false));
  }

  add(label: LabelData): void {
    this.labelData.push(label);
  }

  // checks to see if the label needs to be clipped based on other labels
  private checkForClipping(label: CellLabel, data: LabelData, alignment: CellAlignment): void {
    const getClipLeft = (): number | undefined => {
      const start = label.x + data.expectedWidth - label.textWidth;
      const end = label.x + data.expectedWidth;
      const neighboringLabels = this.labelData.filter(
        (search) => search !== data && search.y === data.y && search.x + search.expectedWidth >= start && search.x <= end
      );
      if (neighboringLabels.length) {
        const neighboringLabel = neighboringLabels.sort((a, b) => a.x - b.x)[0];
        return neighboringLabel.x + neighboringLabel.expectedWidth;
      }
    };

    const getClipRight = (): number | undefined => {
      const start = label.x + data.expectedWidth;
      const end = start + (label.textWidth - data.expectedWidth);
      const neighboringLabels = this.labelData.filter(
        (search) => search.y === data.y && search.x >= start && search.x <= end
      );
      if (neighboringLabels.length) {
        const neighboringLabel = neighboringLabels.sort((a, b) => a.x - b.x)[0];
        return neighboringLabel.x;
      }
    };

    if (label.textWidth > data.expectedWidth) {
      let clipLeft: number | undefined, clipRight: number | undefined;
      if (alignment === 'right') {
        clipLeft = getClipLeft();
      } else if (alignment === 'center') {
        clipLeft = getClipLeft();
        clipRight = getClipRight();
      } else {
        clipRight = getClipRight();
      }
      label.setClip({ clipLeft, clipRight });
    } else {
      label.setClip();
    }
  }

  private compareLabelData(label: CellLabel, data: LabelData): boolean {
    const isSame = (a?: boolean, b?: boolean): boolean => {
      return (!a && !b) || (a && b) ? true : false;
    };

    return (
      label.originalText === data.text &&
      isSame(label.format?.bold, data.format?.bold) &&
      isSame(label.format?.italic, data.format?.italic) &&
      label.format?.textColor === data.format?.textColor
    );
  }

  updateLabel(label: CellLabel, data: LabelData, bounds: Bounds): void {
    label.visible = true;
    if (label.text !== data.text) {
      label.text = data.text;
    }

    let alignment: CellAlignment = Number.isNaN(parseFloat(data.text)) ? 'left' : 'right';
    if (data.format?.alignment === 'right') alignment = 'right';
    else if (data.format?.alignment === 'center') alignment = 'center';
    if (alignment === 'right') {
      label.position.set(data.x + data.expectedWidth - label.textWidth, data.y);
    } else if (alignment === 'center') {
      label.position.set(data.x + data.expectedWidth / 2 - label.textWidth / 2, data.y);
    } else {
      label.position.set(data.x, data.y);
    }
    this.checkForClipping(label, data, alignment);

    // track overflowed widths
    if (data.isQuadrant) {
      label.location = data.location;
      const width = label.textWidth;

      if (data.expectedWidth) {
        label.location = data.location;
        if (label.textWidth > data.expectedWidth) {
          label.overflowRight = label.textWidth - data.expectedWidth;
        } else {
          label.overflowRight = undefined;
        }
      }

      if (width > data.expectedWidth) {
        if (alignment === 'left') {
          label.overflowRight = width - data.expectedWidth;
          label.overflowLeft = undefined;
        } else if (alignment === 'right') {
          label.overflowLeft = width - data.expectedWidth;
          label.overflowRight = undefined;
        }
      } else {
        label.overflowRight = undefined;
        label.overflowLeft = undefined;
      }
      bounds.addRectangle(new Rectangle(label.x, label.y, width, label.height));
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
        this.updateLabel(available[index], data, bounds);
        available.splice(index, 1);
      }
    });

    // use existing labels but change the text
    leftovers.forEach((data, i) => {
      let label: CellLabel;
      if (i < available.length) {
        this.updateLabel(available[i], data, bounds);
      }

      // otherwise create new labels
      else {
        label = this.addChild(new CellLabel(data.format));
        this.updateLabel(label, data, bounds);
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
