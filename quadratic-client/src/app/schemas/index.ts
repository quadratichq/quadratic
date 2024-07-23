import z from 'zod';

const ArrayOutputBaseSchema = z.array(z.any());
export const ArrayOutputSchema = z.union([ArrayOutputBaseSchema, z.array(ArrayOutputBaseSchema)]).optional();
