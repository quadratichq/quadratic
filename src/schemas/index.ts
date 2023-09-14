import z from 'zod';
import { GridFileSchemaV1_0 } from './GridFileV1_0';
import { GridFileSchemaV1_1 } from './GridFileV1_1';
import { ArrayOutputBase, GridFileSchemaV1_2 } from './GridFileV1_2';
import { GridFileSchemaV1_3 } from './GridFileV1_3';
import { GridFileSchemaV1_4, GridFileV1_4 } from './GridFileV1_4';

/**
 * Export types for the grid files
 */

// Type representing one of any of the grid files
export const GridFilesSchema = z.union([
  GridFileSchemaV1_0,
  GridFileSchemaV1_1,
  GridFileSchemaV1_2,
  GridFileSchemaV1_3,
  GridFileSchemaV1_4,
]);
export type GridFiles = z.infer<typeof GridFilesSchema>;

// Map the most recent file schema to the one that will be used in the code
// (Code always assumes the most recent file)
export type GridFile = GridFileV1_4;
export const GridFileSchema = GridFileSchemaV1_4;

/**
 * Export types for use throughout the codebase, all of which today can be derived
 * from the grid file schema.
 */

// Sheet uses everything except these values
const GridFileDataSchema = GridFileSchema.omit({
  version: true,
}).pick({
  sheets: true,
});
export type GridFileData = z.infer<typeof GridFileDataSchema>;

export const ArrayOutputSchema =
  GridFileSchema.shape.sheets.element.shape.cells.element.shape.evaluation_result.unwrap().shape.array_output;
export type ArrayOutput = z.infer<typeof ArrayOutputSchema>;
export type { ArrayOutputBase };
export type Cell = GridFile['sheets'][0]['cells'][0];
export type CellType = GridFile['sheets'][0]['cells'][0]['type'];
export type CellFormat = GridFile['sheets'][0]['formats'][0];
export type CellAlignment = GridFile['sheets'][0]['formats'][0]['alignment'];
export type Border = GridFile['sheets'][0]['borders'][0];
export type Heading = GridFile['sheets'][0]['columns'][0];
export type BorderType = NonNullable<Pick<NonNullable<Border['horizontal']>, 'type'>['type']>;
export type SheetSchema = GridFile['sheets'][0];
export const BorderTypeEnum = GridFileSchemaV1_4.shape.sheets.element.shape.borders.element.shape.horizontal
  .unwrap()
  .shape.type.unwrap().enum;
