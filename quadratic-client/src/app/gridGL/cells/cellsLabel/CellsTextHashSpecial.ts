import type {
  RenderCheckbox,
  RenderDropdown,
  RenderSpecial,
} from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHashSpecial';
import { Container, Point } from 'pixi.js';
import { drawCheckbox, drawDropdown, SpecialSprite } from './drawSpecial';
import { intersects } from '../../helpers/intersects';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { sheets } from '@/app/grid/controller/Sheets';
import { events } from '@/app/events/events';

export class CellsTextHashSpecial extends Container<SpecialSprite> {
  clear() {
    this.removeChildren();
  }

  private drawCheckboxes(checkboxes: RenderCheckbox[]) {
    checkboxes.forEach((checkbox) => {
      this.addChild(drawCheckbox(checkbox));
    });
  }

  private drawDropdowns(dropdowns: RenderDropdown[]) {
    dropdowns.forEach((dropdown) => {
      this.addChild(drawDropdown(dropdown));
    });
  }

  update(special?: RenderSpecial) {
    this.clear();
    if (special) {
      this.drawCheckboxes(special.checkboxes);
      this.drawDropdowns(special.dropdowns);
    }
  }

  // handle clicking on UI elements
  pointerDown(column: number, row: number, world: Point) {
    this.children.forEach((child) => {
      const special = child as SpecialSprite;
      if (special.column === column && special.row === row) {
        console.log(special.type, special.rectangle, world);
        if (special.type === 'checkbox' && intersects.rectanglePoint(special.rectangle, world)) {
          quadraticCore.setCellValue(
            sheets.sheet.id,
            column,
            row,
            special.checkbox ? 'false' : 'true',
            sheets.getCursorPosition()
          );
        } else if (special.type === 'dropdown' && intersects.rectanglePoint(special.rectangle, world)) {
          events.emit('dropdown', special.column, special.row);
        }
      }
    });
  }
}
