import { Dependency } from '../grid/sheet/GridRenderDependency';
import { Border, Cell, CellFormat, Heading } from '../grid/sheet/gridTypes';
import { v4 as uuid } from 'uuid';

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
  version: '1.0';
}

export interface GridFileSchemaV1_1 extends GridFileData {
  version: '1.1';

  // New in 1.1
  modified: number;
  created: number;
  id: string;
  // Note: this is used inside the app, but is overridden when a file is
  // imported by either the file's name on disk or the name in the URL
  filename: string;
}

export function upgradeV1toV1_1(file: GridFileSchemaV1): GridFileSchemaV1_1 {
  const date = Date.now();
  return {
    ...file,
    version: '1.1',
    modified: date,
    created: date,
    id: uuid(),
    filename: 'Untitled',
  };
}

// TODO
// export const validFiles = [{ schema: GridFileSchemaV1, updateFn: upgradeV1toV1_1 }];

export type GridFileSchema = GridFileSchemaV1_1;
