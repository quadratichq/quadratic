import { Coordinate } from '../../gridGL/types/size';

export const clearBordersAction = (args: { start: Coordinate; end: Coordinate; create_transaction?: boolean }) => {
  throw new Error('not implemented');
  // const { start, end, create_transaction } = args;
  // const { sheet } = sheetController;

  // // get all borders in the selection
  // const borderUpdate: Border[] = [];
  // const borderDelete: Coordinate[] = [];
  // for (let y = start.y; y <= end.y; y++) {
  //   for (let x = start.x; x <= end.x; x++) {
  //     const border = sheet.borders.get(x, y);
  //     if (border) {
  //       borderDelete.push({ x, y });
  //     }
  //     if (x === end.x) {
  //       const border = sheet.borders.get(x + 1, y);
  //       if (border?.vertical) {
  //         if (!border.horizontal) {
  //           borderDelete.push({ x: x + 1, y });
  //         } else {
  //           borderUpdate.push({ ...border, vertical: undefined });
  //         }
  //       }
  //     }
  //     if (y === end.y) {
  //       const border = sheet.borders.get(x, y + 1);
  //       if (border?.horizontal) {
  //         if (!border.vertical) {
  //           borderDelete.push({ x, y: y + 1 });
  //         } else {
  //           borderUpdate.push({ ...border, horizontal: undefined });
  //         }
  //       }
  //     }
  //   }
  // }

  // // create transaction to update borders
  // if (create_transaction ?? true) sheetController.start_transaction();

  // const borders: (Border | Coordinate)[] = [];
  // if (borderDelete.length) {
  //   borders.push(
  //     ...borderDelete.map((border) => {
  //       return { x: border.x, y: border.y };
  //     })
  //   );
  // }
  // if (borderUpdate.length) {
  //   borders.push(...borderUpdate);
  // }
  // if (borders.length) {
  //   sheetController.execute_statement({
  //     type: 'SET_BORDERS',
  //     data: borders,
  //   });
  // }
  // if (create_transaction ?? true) sheetController.end_transaction();

  // pixiAppEvents.quadrantsChanged({ range: { start, end } });
};
