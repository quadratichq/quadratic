import z from 'zod';
import { GridFileSchemaV1_2 } from '../../schemas/GridFileV1_2';

export type CellEvaluationResult = NonNullable<
  z.infer<typeof GridFileSchemaV1_2>['cells'][number]['evaluation_result']
>;
