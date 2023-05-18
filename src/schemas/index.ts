import z from 'zod';
import { GridFileV1 } from './GridFileV1';
import { GridFileV1_1, GridFileSchemaV1_1, ArrayOutputBase } from './GridFileV1_1';

/**
 * Export types for the grid files
 */

// Type representing one of any of the grid files
export type GridFiles = GridFileV1 | GridFileV1_1;

// Map the most recent file schema to the one that will be used in the code
// (Code always assumes the most recent file)
export type GridFile = GridFileV1_1;
export const GridFileSchema = GridFileSchemaV1_1;

/**
 * Export types for use throughout the codebase, all of which today can be derived
 * from the grid file schema.
 */

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
export type GridFileData = z.infer<typeof GridFileDataSchema>;

export const ArrayOutputSchema = GridFileSchema.shape.cells.element.shape.evaluation_result.unwrap().shape.array_output;

export type { ArrayOutputBase };
export type Cell = GridFile['cells'][number];
export type CellType = GridFile['cells'][number]['type'];
export type ArrayOutput = NonNullable<GridFile['cells'][number]['evaluation_result']>['array_output'];
export type CellFormat = GridFile['formats'][number];
export type Dependency = GridFile['render_dependency'][number];
export type Coordinate = GridFile['render_dependency'][number]['location'];
export type Border = GridFile['borders'][number];
export type BorderType = NonNullable<Pick<NonNullable<Border['horizontal']>, 'type'>['type']>;
export const BorderTypeEnum = GridFileSchemaV1_1.shape.borders.element.shape.horizontal
  .unwrap()
  .shape.type.unwrap().enum;
export type Heading = GridFile['columns'][0];
