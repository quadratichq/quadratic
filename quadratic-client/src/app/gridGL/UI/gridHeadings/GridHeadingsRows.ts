//! This is the container for row headings. It needs to be separate from GridHeadings because
//! it needs to be placed over the grid lines, while the column headings needs to be under them.

import { GridHeadingsLabels } from '@/app/gridGL/UI/gridHeadings/GridHeadingsLabels';
import { Container, Graphics } from 'pixi.js';

export class GridHeadingRows extends Container {
  headingsGraphics: Graphics;
  labels: GridHeadingsLabels;

  constructor() {
    super();
    this.headingsGraphics = this.addChild(new Graphics());
    this.labels = this.addChild(new GridHeadingsLabels());
  }
}
