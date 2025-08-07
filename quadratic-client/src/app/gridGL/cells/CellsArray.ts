// import { events } from '@/app/events/events';
// import { sheets } from '@/app/grid/controller/Sheets';
// import type { Sheet } from '@/app/grid/sheet/Sheet';
// import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
// import type { BorderCull } from '@/app/gridGL/cells/drawBorders';
// import { borderLineWidth, drawBorder, drawLine } from '@/app/gridGL/cells/drawBorders';
// import { generatedTextures } from '@/app/gridGL/generateTextures';
// import { intersects } from '@/app/gridGL/helpers/intersects';
// import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
// import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
// import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
// import type { JsCodeCell, JsCoordinate, JsRenderCodeCell, RunError } from '@/app/quadratic-core-types';
// import { colors } from '@/app/theme/colors';
// import mixpanel from 'mixpanel-browser';
// import { Container, Graphics, ParticleContainer, Point, Rectangle, Sprite, Texture } from 'pixi.js';

// const SPILL_HIGHLIGHT_THICKNESS = 1;
// const SPILL_HIGHLIGHT_COLOR = colors.cellColorError;
// const SPILL_FILL_ALPHA = 0.025;

// export class CellsArray extends Container {
//   private cellsSheet: CellsSheet;
//   private codeCells: Map<String, JsRenderCodeCell>;

//   private particles: ParticleContainer;
//   // only used for the spill error indicators (lines are drawn using sprites in particles for performance)
//   private graphics: Graphics;
//   private lines: BorderCull[];

//   constructor(cellsSheet: CellsSheet) {
//     super();
//     this.particles = this.addChild(new ParticleContainer(undefined, { vertices: true, tint: true }, undefined, true));
//     this.graphics = this.addChild(new Graphics());
//     this.cellsSheet = cellsSheet;
//     this.lines = [];
//     this.codeCells = new Map();
//     events.on('renderCodeCells', this.renderCodeCells);
//     events.on('sheetOffsetsUpdated', this.sheetOffsets);
//     events.on('updateCodeCell', this.updateCodeCell);
//   }

//   destroy() {
//     events.off('renderCodeCells', this.renderCodeCells);
//     events.off('sheetOffsetsUpdated', this.sheetOffsets);
//     events.off('updateCodeCell', this.updateCodeCell);
//     super.destroy();
//   }

//   private key(x: number, y: number): string {
//     return `${x},${y}`;
//   }

//   private renderCodeCells = (sheetId: string, codeCells: JsRenderCodeCell[]) => {
//     if (sheetId === this.sheetId) {
//       const map = new Map();
//       codeCells.forEach((cell) => map.set(this.key(cell.x, cell.y), cell));
//       this.codeCells = map;
//       this.create();
//     }
//   };

//   private sheetOffsets = (sheetId: string) => {
//     if (sheetId === this.cellsSheet.sheetId) {
//       this.create();
//     }
//   };

//   private updateCodeCell = (options: {
//     sheetId: string;
//     x: number;
//     y: number;
//     renderCodeCell?: JsRenderCodeCell;
//     codeCell?: JsCodeCell;
//   }) => {
//     const { sheetId, x, y, renderCodeCell, codeCell } = options;
//     if (sheetId === this.sheetId) {
//       if (renderCodeCell) {
//         this.codeCells.set(this.key(x, y), renderCodeCell);
//       } else {
//         this.codeCells.delete(this.key(x, y));
//       }
//       this.create();

//       if (!!codeCell && codeCell.std_err !== null && codeCell.evaluation_result) {
//         try {
//           // std_err is not null, so evaluation_result will be RunError
//           const runError = JSON.parse(codeCell.evaluation_result) as RunError;
//           // track unimplemented errors
//           if (typeof runError.msg === 'object' && 'Unimplemented' in runError.msg) {
//             trackEvent('[CellsArray].updateCodeCell', {
//               type: codeCell.language,
//               error: runError.msg,
//             });
//           }
//         } catch (error) {
//           console.error('[CellsArray] Error parsing codeCell.evaluation_result', error);
//         }
//       }
//     }
//   };

//   get sheetId(): string {
//     return this.cellsSheet.sheetId;
//   }

//   private create() {
//     this.lines = [];
//     this.particles.removeChildren();
//     this.graphics.clear();
//     this.cellsSheet.cellsMarkers.clear();
//     const codeCells = this.codeCells;
//     if (codeCells.size === 0) {
//       pixiApp.cursor.dirty = true;
//       pixiApp.setViewportDirty();
//       return;
//     }

//     const cursor = sheets.sheet.cursor.position;
//     codeCells?.forEach((codeCell) => {
//       const cell = inlineEditorHandler.getShowing();
//       const editingCell = cell && codeCell.x === cell.x && codeCell.y === cell.y && cell.sheetId === this.sheetId;
//       this.draw(codeCell, cursor, editingCell);
//     });
//     if (pixiApp.cursor) {
//       pixiApp.cursor.dirty = true;
//     }
//     pixiApp.setViewportDirty();
//   }

//   updateCellsArray = () => {
//     this.create();
//   };

//   cheapCull = (bounds: Rectangle): void => {
//     this.lines.forEach((line) => (line.sprite.visible = intersects.rectangleRectangle(bounds, line.rectangle)));
//   };

//   get sheet(): Sheet {
//     const sheet = sheets.getById(this.sheetId);
//     if (!sheet) throw new Error('Expected sheet to be defined in CellsArray.sheet');
//     return sheet;
//   }

//   private draw(codeCell: JsRenderCodeCell, cursor: JsCoordinate, editingCell?: boolean): void {
//     const start = this.sheet.getCellOffsets(Number(codeCell.x), Number(codeCell.y));

//     const overlapTest = new Rectangle(Number(codeCell.x), Number(codeCell.y), codeCell.w - 1, codeCell.h - 1);
//     if (codeCell.spill_error) {
//       overlapTest.width = 1;
//       overlapTest.height = 1;
//     }

//     let tint = colors.independence;
//     if (codeCell.language === 'Python') {
//       tint = colors.cellColorUserPython;
//     } else if (codeCell.language === 'Formula') {
//       tint = colors.cellColorUserFormula;
//     } else if (codeCell.language === 'Javascript') {
//       tint = colors.cellColorUserJavascript;
//     }

//     if (!pixiAppSettings.showCellTypeOutlines) {
//       // only show the entire array if the cursor overlaps any part of the output
//       if (!intersects.rectanglePoint(overlapTest, new Point(cursor.x, cursor.y))) {
//         this.cellsSheet.cellsMarkers.add(start, codeCell, false);
//         return;
//       }
//     }

//     if (!editingCell) {
//       this.cellsSheet.cellsMarkers.add(start, codeCell, true);
//     }
//     const end = this.sheet.getCellOffsets(Number(codeCell.x) + codeCell.w, Number(codeCell.y) + codeCell.h);
//     if (codeCell.spill_error) {
//       const cursorPosition = sheets.sheet.cursor.position;
//       if (cursorPosition.x !== Number(codeCell.x) || cursorPosition.y !== Number(codeCell.y)) {
//         this.lines.push(
//           ...drawBorder({
//             alpha: 0.5,
//             tint,
//             x: start.x,
//             y: start.y,
//             width: start.width,
//             height: start.height,
//             getSprite: this.getSprite,
//             top: true,
//             left: true,
//             bottom: true,
//             right: true,
//           })
//         );
//       } else {
//         this.drawDashedRectangle(new Rectangle(start.x, start.y, end.x - start.x, end.y - start.y), tint);
//         codeCell.spill_error?.forEach((error) => {
//           const rectangle = this.sheet.getCellOffsets(Number(error.x), Number(error.y));
//           this.drawDashedRectangle(rectangle, SPILL_HIGHLIGHT_COLOR);
//         });
//       }
//     } else {
//       this.drawBox(start, end, tint);
//     }
//   }

//   private drawBox(start: Rectangle, end: Rectangle, tint: number) {
//     this.lines.push(
//       ...drawBorder({
//         alpha: 0.5,
//         tint,
//         x: start.x,
//         y: start.y,
//         width: end.x - start.x,
//         height: end.y - start.y,
//         getSprite: this.getSprite,
//         top: true,
//         left: true,
//         bottom: true,
//         right: true,
//       })
//     );
//     const right = end.x !== start.x + start.width;
//     if (right) {
//       this.lines.push(
//         drawLine({
//           x: start.x + start.width - borderLineWidth / 2,
//           y: start.y + borderLineWidth / 2,
//           width: borderLineWidth,
//           height: start.height,
//           alpha: 0.5,
//           tint,
//           getSprite: this.getSprite,
//         })
//       );
//     }
//     const bottom = end.y !== start.y + start.height;
//     if (bottom) {
//       this.lines.push(
//         drawLine({
//           x: start.x + borderLineWidth / 2,
//           y: start.y + start.height - borderLineWidth / 2,
//           width: start.width - borderLineWidth,
//           height: borderLineWidth,
//           alpha: 0.5,
//           tint,
//           getSprite: this.getSprite,
//         })
//       );
//     }
//   }

//   private drawDashedRectangle(rectangle: Rectangle, color: number) {
//     this.graphics.lineStyle();
//     this.graphics.beginFill(color, SPILL_FILL_ALPHA);
//     this.graphics.drawRect(rectangle.left, rectangle.top, rectangle.width, rectangle.height);
//     this.graphics.endFill();

//     const minX = rectangle.left;
//     const minY = rectangle.top;
//     const maxX = rectangle.right;
//     const maxY = rectangle.bottom;

//     const path = [
//       [maxX, minY],
//       [maxX, maxY],
//       [minX, maxY],
//       [minX, minY],
//     ];

//     this.graphics.moveTo(minX, minY);
//     for (let i = 0; i < path.length; i++) {
//       this.graphics.lineStyle({
//         width: SPILL_HIGHLIGHT_THICKNESS,
//         color,
//         texture: i % 2 === 0 ? generatedTextures.dashedHorizontal : generatedTextures.dashedVertical,
//       });
//       this.graphics.lineTo(path[i][0], path[i][1]);
//     }
//   }

//   private getSprite = (): Sprite => {
//     return this.particles.addChild(new Sprite(Texture.WHITE));
//   };

//   isCodeCell(x: number, y: number): boolean {
//     return this.codeCells.has(this.key(x, y));
//   }
// }
