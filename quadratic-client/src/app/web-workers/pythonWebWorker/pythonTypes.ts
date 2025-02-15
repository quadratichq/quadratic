export interface InspectPython {
  lineno: number;
  col_offset: number;
  end_lineno: number;
  end_col_offset: number;
  value_type?: string;
}

export type ComputedInspectPython = InspectPython & { output_type?: string; output_size?: string };

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

export type outputType = 'blank' | 'number' | 'text' | 'logical' | 'instant';

export interface PythonSuccess {
  array_output: string[][];
  typed_array_output: [string, outputType][];
  code: string;
  input_python_stack_trace: string;
  output?: [string, outputType];
  output_size?: number[];

  // Python type to show in CodeEditor
  output_type?: string;

  std_err: string;
  std_out: string;
  success: true;

  lineno: undefined;

  has_headers: boolean;
}

export interface PythonError {
  std_out: string;
  std_err: string;

  output: undefined;
  output_type: undefined;
  output_size: undefined;
  array_output: undefined;
  typed_array_output?: [string, outputType][];

  success: false;
  input_python_stack_trace: string;
  line_number: number;

  lineno?: number;

  has_headers: boolean;
}

export type PythonRun = PythonSuccess | PythonError;
