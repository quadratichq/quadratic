import { CELL_HEIGHT, CELL_WIDTH } from '@/constants/gridConstants';
import {sheets} from '@/grid/controller/Sheets';
import {Sheet} from '@/grid/sheet/Sheet';
import {JsImageOutput} from '@/quadratic-core/types';
import {colors} from '@/theme/colors';

const DEFAULT_IMAGE_WIDTH = 600;
const DEFAULT_IMAGE_HEIGHT = 460;

const PNG_HEADER = [137, 80, 78, 71, 13, 10, 26, 10];

export class ImageCell {
  private imageCell: JsImageOutput;
  private image: HTMLOrSVGImageElement;

  sheet: Sheet;

  div: HTMLDivElement;

  constructor(imageCell: JsImageOutput) {
    this.imageCell = imageCell;
    const sheet = sheets.getById(imageCell.sheet_id)!;
    if (!sheet) {
      throw new Error(`Expected to find sheet with id ${imageCell.sheet_id}`);
    }
    this.sheet = sheet;

    this.div = document.createElement('div');
    this.div.className = "image-cell";
    this.div.style.border = `1pm solid ${colors.cellColorUserPythonRgba}`;
    this.div.style.background = 'magenta'; // TODO: Temporary
    const offset = this.sheet.getCellOffsets(Number(imageCell.x), Number(imageCell.y));

    // the 0.5 is adjustment for the border
    this.div.style.left = `${offset.x - 0.5}px`;
    this.div.style.top = `${offset.y + offset.height - 0.5}px`;
    this.div.style.minWidth = `${CELL_WIDTH}px`;
    this.div.style.minHeight = `${CELL_HEIGHT}px`;

    this.image = this.createImage(imageCell.image);

    this.div.append(this.image)

    if (this.sheet.id !== sheets.sheet.id) {
      this.div.style.visibility = 'hidden';
    }
  }

  private createImage(imageData: Array<number>): HTMLOrSVGImageElement {
    const image = document.createElement("img");
    const base64ImageData = btoa(String.fromCharCode.apply(null, imageData));

    let imageFormat = "unknown";
    if (imageData.slice(0, PNG_HEADER.length).toString() === PNG_HEADER.toString()) {
      imageFormat = "png";
    } else {
      console.log("Unknown image header: ", imageData.slice(0, 16));
    }

    image.src = `data:image/${imageFormat};base64,${base64ImageData}`
    image.width = this.width;
    image.height = this.height;
    return image
  }

  get x(): number {
    return Number(this.imageCell.x);
  }

  get y(): number {
    return Number(this.imageCell.y);
  }

  private get width(): number {
    return DEFAULT_IMAGE_WIDTH;  // TODO(jrice): size from image?
  }

  private get height(): number {
    return DEFAULT_IMAGE_HEIGHT;
  }

  isOutputEqual(imageCell: JsImageOutput): boolean {
    return (
      this.imageCell.sheet_id === imageCell.sheet_id && imageCell.x === this.imageCell.x && imageCell.y === this.imageCell.y
    );
  }

  update(imageCell: JsImageOutput) {
    this.imageCell = imageCell;
    // TODO: Update the actual image, too
  }

  changeSheet(sheetId: string) {
    this.div.style.visibility = sheetId === this.imageCell.sheet_id ? 'visible' : 'hidden';
  }

  isSheet(sheetId: string) {
    return sheetId === this.imageCell.sheet_id;
  }

  updateOffsets() {
    const offset = this.sheet.getCellOffsets(this.x, this.y);

    // the 0.5 is adjustment for the border
    this.div.style.left = `${offset.x - 0.5}px`;
    this.div.style.top = `${offset.y + offset.height - 0.5}px`;
  }
}
