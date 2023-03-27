import { Cell } from '../sheet/gridTypes';
import { runFormula } from './formulas/runFormula';
import { runPython } from './python/runPython';
import { cellEvaluationReturnType } from './types';

export const runCellComputation = async (cell: Cell, pyodide?: any): Promise<cellEvaluationReturnType> => {
  if (cell.type === 'FORMULA') {
    let result = await runFormula(cell.formula_code || '', { x: cell.x, y: cell.y });
    return {
      success: result.success,
      std_out: undefined,
      std_err: result.error_msg !== null ? result.error_msg : undefined,
      output_value: result.output_value,
      output_type: 'String',
      cells_accessed: result.cells_accessed,
      array_output: result.array_output || [],
      formatted_code: cell.formula_code || '',
      error_span: null,
    };
  } else if (cell.type === 'PYTHON') {
    let result = await runPython(cell.python_code || '', pyodide);
    return {
      success: result.success,
      std_out: result.input_python_std_out,
      std_err: result.input_python_stack_trace,
      output_value: result.output_value,
      output_type: result.output_type,
      cells_accessed: result.cells_accessed,
      array_output: result.array_output,
      formatted_code: result.formatted_code,
      error_span: null,
    };
  } else {
    throw new Error('Unsupported cell type');
  }
};
