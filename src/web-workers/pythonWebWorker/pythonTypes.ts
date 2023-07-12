import { ArrayOutput, Cell } from '../../schemas';

export interface PythonReturnType {
  cells_accessed: [number, number][];
  success: boolean;
  input_python_stack_trace: string;
  input_python_std_out: string;
  output_value: string | null;
  array_output: ArrayOutput;
  formatted_code: string;
}

export interface PythonMessage {
  type: 'results' | 'execute' | 'not-loaded' | 'get-cells' | 'python-loaded' | 'python-error';
  python?: string;
  results?: PythonReturnType;
  error?: string;
  range?: { x0: number; y0: number; x1: number; y1: number };
  cells?: Cell[];
}
