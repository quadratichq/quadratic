import { Container } from 'pixi.js';
import { Coordinate } from '../../types/size';
import { CellLabel } from './CellLabel';

interface LabelData {
  text: string;
  x: number;
  y: number;
  location?: Coordinate;
  isQuadrant?: boolean;
  expectedWidth: number;
}

export class CellsLabels extends Container {
  private labelData: LabelData[] = [];

  clear() {
    this.labelData = [];
  }

  add(label: LabelData): void {
    this.labelData.push(label);
  }

  // checks to see if the label needs to be clipped based on other labels
  private checkForClipping(label: CellLabel, data: LabelData): void {
    if (label.textWidth! > data.expectedWidth) {
      const start = label.x + data.expectedWidth;
      const end = start + (label.width - data.expectedWidth);
      const labels = this.labelData.filter(search => search.y === data.y && search.x >= start && search.x <= end);
      if (labels.length) {
        label.setMask(data.expectedWidth);
      } else {
        label.clearMask();
      }
    } else {
      label.clearMask();
    }
  }

  // add labels to headings using cached labels
  update() {
    // keep current children to use as the cache
    this.children.forEach((child) => (child.visible = false));

    const available = [...this.children] as CellLabel[];
    const leftovers: LabelData[] = [];

    // reuse existing labels that have the same text
    this.labelData.forEach((data) => {
      const index = available.findIndex((label) => label.text === data.text);
      if (index === -1) {
        leftovers.push(data);
      } else {
        const label = available[index];
        label.position.set(data.x, data.y);
        label.visible = true;
        this.checkForClipping(label, data);

        // track overflowed widths
        if (data.isQuadrant) {
          label.location = data.location;
          const width = label.width;
          if (width > data.expectedWidth) {
            label.overflowRight = width - data.expectedWidth;
          }
        }
        available.splice(index, 1);
      }
    });

    // use existing labels but change the text
    leftovers.forEach((data, i) => {
      let label: CellLabel;
      if (i < available.length) {
        label = available[i];
        label.visible = true;
      }

      // otherwise create new labels
      else {
        label = this.addChild(new CellLabel());
      }
      label.position.set(data.x, data.y);
      label.text = data.text;

      this.checkForClipping(label, data);

      // track overflowed widths
      if (data.expectedWidth) {
        label.location = data.location;
        if (label.textWidth > data.expectedWidth) {
          label.overflowRight = label.textWidth - data.expectedWidth;
        }
      }
    });
  }

  get(): CellLabel[] {
    return this.children as CellLabel[];
  }
}
