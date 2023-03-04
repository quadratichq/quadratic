import { Border, Cell, CellFormat, Heading } from '../../sheet/gridTypes';

export interface GridFileSchemaV1 {
  // For future file versions we should make a function that converts old versions to the latest version.
  // Each version should be a new interface to help us avoid breaking changes.
  // The code base should only ever use the latest version.
  // And we can wrap where we import files to convert them to the latest version.
  // This way only one file needs to care about file version and the rest of the code base can just use the latest version.
  cells: Cell[];
  formats: CellFormat[];
  columns: Heading[];
  rows: Heading[];
  borders: Border[];
  cell_dependency: string;
  version: '1.0';
}
