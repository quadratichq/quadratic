import z from 'zod';
import { Dependency } from '../grid/sheet/GridRenderDependency';
import { GridFileV1 } from './GridFileV1';
import { GridFileV1_1, GridFileSchemaV1_1 } from './GridFileV1_1';

// Type representing one of any of the grid files
export type GridFiles = GridFileV1 | GridFileV1_1;

// Map the most recent file schema to the one that will be used in the code
// (Code always assumes the most recent file)
export type { GridFileV1_1 as GridFile };
export const GridFileSchema = GridFileSchemaV1_1;

// Parts of the file schema used by the sheet
const GridFileDataSchema = GridFileSchema.pick({
  borders: true,
  cells: true,
  cell_dependency: true,
  columns: true,
  formats: true,
  render_dependency: true,
  rows: true,
});
export type GridFileData = z.infer<typeof GridFileDataSchema> & { render_dependency: Dependency[] };
