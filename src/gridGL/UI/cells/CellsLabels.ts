import { Container, Rectangle } from 'pixi.js';
import { Coordinate } from '../../types/size';
import { CellLabel } from './CellLabel';
import { CellAlignment, CellFormat } from '../../../grid/sheet/gridTypes';
import { Bounds } from '../../../grid/sheet/Bounds';
import { isStringANumber } from '../../../helpers/isStringANumber';

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
  private labelData: LabelData[] = [];

  clear() {
    this.labelData = [];
    this.children.forEach((child) => (child.visible = false));
  }

  add(label: LabelData): void {
    this.labelData.push(label);
  }

  // checks to see if the label needs to be clipped based on other labels
  private checkForClipping(label: CellLabel): void {
    const data = label.data;
    if (!data) {
      throw new Error('Expected label.data to be defined in checkForClipping');
    }
    const getClipLeft = (): number | undefined => {
      const start = label.x + data.expectedWidth - label.textWidth;
      // const end = start + (label.textWidth - data.expectedWidth);
      const neighboringLabels = this.labelData.filter(
        (search) =>
          search !== data &&
          search.y === data.y &&
          search.x + search.expectedWidth >= start &&
          search.location.x < data.location.x
      );
      if (neighboringLabels.length) {
        const neighboringLabel = neighboringLabels.sort((a, b) => b.location.x - a.location.x)[0];
        return neighboringLabel.x + neighboringLabel.expectedWidth;
      }
    };

    const getClipRight = (): number | undefined => {
      const start = label.x + data.expectedWidth;
      const end = start + (label.textWidth - data.expectedWidth);
      const neighboringLabels = this.labelData.filter(
        (search) => search !== data && search.y === data.y && search.x >= start && search.x <= end
      );
      if (neighboringLabels.length) {
        const neighboringLabel = neighboringLabels.sort((a, b) => a.location.x - b.location.x)[0];
        return neighboringLabel.x;
      }
    };

    if (label.textWidth > data.expectedWidth) {
      let clipLeft: number | undefined, clipRight: number | undefined;
      if (data.alignment === 'right') {
        clipLeft = getClipLeft();
      } else if (data.alignment === 'center') {
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

    return (
      label.data?.text === data.text &&
      isSame(label.data?.format?.bold, data.format?.bold) &&
      isSame(label.data?.format?.italic, data.format?.italic) &&
      label.data?.format?.textColor === data.format?.textColor
    );
  }

  updateLabel(label: CellLabel, data: LabelData): void {
    label.data = data;
    label.visible = true;
    if (label.text !== data.text) {
      label.text = data.text;
    }

    data.alignment = isStringANumber(data.originalText) ? 'right' : 'left';
    if (data.format?.alignment === 'right') data.alignment = 'right';
    else if (data.format?.alignment === 'center') data.alignment = 'center';
    else if (data.format?.alignment === 'left') data.alignment = 'left';
    if (data.alignment === 'right') {
      label.position.set(data.x + data.expectedWidth - label.textWidth, data.y);
    } else if (data.alignment === 'center') {
      label.position.set(data.x + data.expectedWidth / 2 - label.textWidth / 2, data.y);
    } else {
      label.position.set(data.x, data.y);
    }

    // this ensures that the text is redrawn during column resize (otherwise clipping will not work properly)
    if (!label.lastPosition || !label.lastPosition.equals(label.position)) {
      label.dirty = true;
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
      let label: CellLabel;
      if (i < available.length) {
        this.updateLabel(available[i], data);
      }

      // otherwise create new labels
      else {
        label = this.addChild(new CellLabel(data));
        this.updateLabel(label, data);
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
