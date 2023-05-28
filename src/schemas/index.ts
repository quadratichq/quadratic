import z from 'zod';
import { GridFileV1 } from './GridFileV1';
import { GridFileV1_1 } from './GridFileV1_1';
import { GridFileV1_2, GridFileSchemaV1_2 } from './GridFileV1_3';

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
  sheets: true,
});
export type GridFileData = z.infer<typeof GridFileDataSchema>;

export type Cell = GridFile['sheets'][0]['cells'][0];
export type CellType = GridFile['sheets'][0]['cells'][0]['type'];
export type CellFormat = GridFile['sheets'][0]['formats'][0];
export type Border = GridFile['sheets'][0]['borders'][0];
export type Heading = GridFile['sheets'][0]['columns'][0];
export type BorderType = NonNullable<Pick<NonNullable<Border['horizontal']>, 'type'>['type']>;
export type SheetSchema = GridFile['sheets'][0];
export const BorderTypeEnum = GridFileSchemaV1_2.shape.sheets.element.shape.borders.element.shape.horizontal
  .unwrap()
  .shape.type.unwrap().enum;
