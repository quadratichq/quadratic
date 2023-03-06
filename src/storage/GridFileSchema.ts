import { Dependency } from '../grid/sheet/GridRenderDependency';
import { Border, Cell, CellFormat, Heading } from '../grid/sheet/gridTypes';

export interface GridFileData {
  cells: Cell[];
  formats: CellFormat[];
  columns: Heading[];
  rows: Heading[];
  borders: Border[];
  cell_dependency: string;

  // todo: this goes away when alignment branch is merged
  render_dependency: Dependency[];
}

export interface GridFileSchemaV1 extends GridFileData {
  // For future file versions we should make a function that converts old versions to the latest version.
  // Each version should be a new interface to help us avoid breaking changes.
  // The code base should only ever use the latest version.
  // And we can wrap where we import files to convert them to the latest version.
  // This way only one file needs to care about file version and the rest of the code base can just use the latest version.
  version: '1.0';
  modified: number;
  created: number;
  id: string;
  filename: string;
}
