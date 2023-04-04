import { GridFileV1 } from './GridFileV1';
import { GridFileV1_1, GridFileSchemaV1_1 } from './GridFileV1_1';

export type GridFiles = GridFileV1 | GridFileV1_1;

export type { GridFileV1_1 as GridFile };
export { GridFileSchemaV1_1 as GridFileSchema };
