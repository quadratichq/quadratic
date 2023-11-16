import { Coordinate } from '../../../gridGL/types/size';

// TODO: Delete this file

export interface runFormulaReturnType {
  cells_accessed: [number, number][];
  success: boolean;
  error_span: [number, number] | null;
  error_msg: string | null;
  output_value: string | null;
  array_output: string[][] | null;
}

export async function runFormula(formula_code: string, pos: Coordinate): Promise<runFormulaReturnType> {
  // const output = await eval_formula(formula_code, pos.x, pos.y, GetCellsDB);
  return {} as runFormulaReturnType;
}
