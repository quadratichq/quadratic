import { debugShowRunComputation } from '../../debugFlags';
import { Cell } from '../../schemas';
import { webWorkers } from '../../web-workers/webWorkers';
import { runFormula } from './formulas/runFormula';
import { CellEvaluationResult } from './types';

export const runCellComputation = async (cell: Cell): Promise<CellEvaluationResult> => {
  if (cell.type === 'FORMULA') {
    let result = await runFormula(cell.formula_code || '', { x: cell.x, y: cell.y });
    return {
      success: result.success,
      std_out: undefined,
      std_err: result.error_msg !== null ? result.error_msg : undefined,
      output_value: result.output_value,
      cells_accessed: result.cells_accessed,
      array_output: result.array_output || [],
      formatted_code: cell.formula_code || '',
      error_span: null,
    };
  } else if (cell.type === 'PYTHON') {
    let result = await webWorkers.runPython(cell.python_code || '');

    // prints result of computation to console to create tests
    if (debugShowRunComputation) {
      console.log(`'${cell.python_code}': \`${JSON.stringify(result).replaceAll('\\', '\\\\')}\`,`);
    }

    return {
      success: result.success,
      std_out: result.input_python_std_out,
      std_err: result.input_python_stack_trace,
      output_value: result.output_value,
      cells_accessed: result.cells_accessed,
      array_output: result.array_output,
      formatted_code: result.formatted_code,
      error_span: null,
    };
  } else if (cell.type === 'AI') {
    return {
      success: false,
      std_out: undefined,
      std_err: 'AI cell type is no longer supported.',
      output_value: null,
      cells_accessed: [],
      array_output: [],
      formatted_code: '',
      error_span: null,
    };
  } else {
    throw new Error('Unsupported cell type');
  }
};
