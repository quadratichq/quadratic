import z from 'zod';

export const DEFAULT_NUMBER_OF_DECIMAL_PLACES = 2;

export const CellTextFormatSchema = z.union([
  z.object({
    type: z.literal('NUMBER'),
    decimalPlaces: z.number().optional(),
  }),
  z.object({
    type: z.literal('CURRENCY'),
    display: z.literal('CURRENCY'),
    symbol: z.string().optional(),
    decimalPlaces: z.number().optional(),
  }),
  z.object({
    type: z.literal('PERCENTAGE'),
    decimalPlaces: z.number().optional(),
  }),
  z.object({
    type: z.literal('EXPONENTIAL'),
    decimalPlaces: z.number().optional(),
  }),
]);
export type CellTextFormat = z.infer<typeof CellTextFormatSchema>;
