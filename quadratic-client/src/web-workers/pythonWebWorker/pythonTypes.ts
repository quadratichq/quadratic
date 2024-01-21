export interface PythonReturnType {
  code: string;
  success: boolean;
  input_python_stack_trace: string;
  input_python_std_out: string;
  output_value: string | null;
  output_type: string | null;
  bytes_output: Uint8Array | null;
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
  pos?: { x: number; y: number };
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

export type EvaluationResult = {
  output_type?: string;
  line_number?: number;

  // single value
  type?: string;
  value?: string;

  // array value
  size?: { w: number; h: number };
  values?: { type: string; value: string }[];
};
