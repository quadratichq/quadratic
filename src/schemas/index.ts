import z from 'zod';
import { GridFileV1 } from './GridFileV1';
import { GridFileV1_1, GridFileSchemaV1_1 } from './GridFileV1_1';
import { GridFileSchemaV1_2, GridFileV1_2 } from './GridFileV1_2';

/**
 * Export types for the grid files
 */

// Type representing one of any of the grid files
export type GridFiles = GridFileV1 | GridFileV1_1 | GridFileV1_2;

// Map the most recent file schema to the one that will be used in the code
// (Code always assumes the most recent file)
export type GridFile = GridFileV1_2;
export const GridFileSchema = GridFileSchemaV1_2;

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

export type Cell = GridFile['cells'][0];
export type CellType = GridFile['cells'][0]['type'];
export type CellFormat = GridFile['formats'][0];
export type CellAlignment = GridFile['formats'][0]['alignment'];
export type Dependency = GridFile['render_dependency'][0];
export type Coordinate = GridFile['render_dependency'][0]['location'];
export type Border = GridFile['borders'][0];
export type BorderType = NonNullable<Pick<NonNullable<Border['horizontal']>, 'type'>['type']>;
export const BorderTypeEnum = GridFileSchemaV1_1.shape.borders.element.shape.horizontal
  .unwrap()
  .shape.type.unwrap().enum;
export type Heading = GridFile['columns'][0];
