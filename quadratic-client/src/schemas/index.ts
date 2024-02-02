import z from 'zod';
import { GridFileSchemaV1_0 } from './GridFileV1_0';
import { GridFileSchemaV1_1 } from './GridFileV1_1';
import { GridFileSchemaV1_2 } from './GridFileV1_2';
import { ArrayOutputBase, GridFileSchemaV1_3, GridFileV1_3 } from './GridFileV1_3';

/**
 * Export types for the grid files
 */

// Type representing one of any of the grid files
export const GridFilesSchema = z.union([
  GridFileSchemaV1_0,
  GridFileSchemaV1_1,
  GridFileSchemaV1_2,
  GridFileSchemaV1_3,
]);
export type GridFiles = z.infer<typeof GridFilesSchema>;

// Map the most recent file schema to the one that will be used in the code
// (Code always assumes the most recent file)
export type GridFile = GridFileV1_3;
export const GridFileSchema = GridFileSchemaV1_3;

/**
 * Export types for use throughout the codebase, all of which today can be derived
 * from the grid file schema.
 */

// Sheet uses everything except these values
const GridFileDataSchema = GridFileSchema.omit({
  version: true,
});
export type GridFileData = z.infer<typeof GridFileDataSchema>;

export const ArrayOutputSchema = GridFileSchema.shape.cells.element.shape.evaluation_result.unwrap().shape.array_output;
export type ArrayOutput = z.infer<typeof ArrayOutputSchema>;
export type { ArrayOutputBase };
export type Cell = GridFile['cells'][0];
export type CellType = GridFile['cells'][0]['type'];
export type CellFormat = GridFile['formats'][0];
export type CellAlignment = GridFile['formats'][0]['alignment'];
export type Border = GridFile['borders'][0];
export type BorderType = NonNullable<Pick<NonNullable<Border['horizontal']>, 'type'>['type']>;
export const BorderTypeEnum = GridFileSchema.shape.borders.element.shape.horizontal.unwrap().shape.type.unwrap().enum;
export type Heading = GridFile['columns'][0];
