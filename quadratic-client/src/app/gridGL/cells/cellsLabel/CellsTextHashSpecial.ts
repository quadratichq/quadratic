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
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';
import { hasPermissionToEditFile } from '@/app/actions';

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
  // if world is true, it skips the check and automatically triggers (reuse by pressing Space on cell)
  clickedToCell(column: number, row: number, world: Point | true) {
    const { permissions } = pixiAppSettings.editorInteractionState;
    if (!hasPermissionToEditFile(permissions)) {
      return;
    }

    this.children.forEach((child) => {
      const special = child as SpecialSprite;
      if (special.column === column && special.row === row) {
        if (special.type === 'checkbox' && (world === true || intersects.rectanglePoint(special.rectangle, world))) {
          quadraticCore.setCellValue(
            sheets.sheet.id,
            column,
            row,
            special.checkbox ? 'false' : 'true',
            sheets.getCursorPosition()
          );
        } else if (
          special.type === 'dropdown' &&
          (world === true || intersects.rectanglePoint(special.rectangle, world))
        ) {
          events.emit('triggerCell', special.column, special.row, false);
        }
      }
    });
  }
}
