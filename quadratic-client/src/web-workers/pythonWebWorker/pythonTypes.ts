export interface PythonReturnType {
  // this should be tracked by calls to rust to get the data
  // cells_accessed: [number, number][];

  code: string;
  formatted_code: string;

  success: boolean;
  input_python_stack_trace: string;
  input_python_std_out: string;

  output_value: string | null;
  output_type: string | null;
  // array_output: ArrayOutput;
}

export interface CellRef {
  x: number;
  y: number;
  sheetId: string;
}

export interface PythonMessage {
  type:
    | 'results'
    | 'execute'
    | 'not-loaded'
    | 'get-cells'
    | 'python-loaded'
    | 'python-error'
    | 'inspect'
    | 'inspect-results';
  python?: string;
  results?: any;
  error?: string;
  range?: { sheet: string; x0: number; y0: number; x1: number; y1: number; lineNumber: number };
  cells?: { x: number; y: number; value: string; type_name: string }[];
}

export interface InspectPythonReturnType {
  lineno: number;
  col_offset: number;
  end_lineno: number;
  end_col_offset: number;
  value_type?: string;
}

export type ComputedPythonReturnType = InspectPythonReturnType & { output_type?: string; output_size?: string };
