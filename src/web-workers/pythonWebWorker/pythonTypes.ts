export interface PythonReturnType {
  // this should be tracked by calls to rust to get the data
  // cells_accessed: [number, number][];

  formatted_code: string;

  success: boolean;
  input_python_stack_trace: string;
  input_python_std_out: string;

  output_value: string | null;
  // array_output: ArrayOutput;
}

export interface CellRef {
  x: number;
  y: number;
  sheetId: string;
}

export interface PythonMessage {
  type: 'results' | 'execute' | 'not-loaded' | 'get-cells' | 'python-loaded' | 'python-error';
  python?: string;
  results?: any;
  error?: string;
  range?: { sheet: string; x0: number; y0: number; x1: number; y1: number; lineNumber: number };
  cells?: { x: number; y: number; value: string }[];
}
