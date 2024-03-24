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

export type outputType = 'number' | 'number' | 'text' | 'logical' | 'instant';

export interface PythonSuccess {
  array_output: string[];
  typed_array_output: [string, outputType][];
  code: string;
  formatted_code: string;
  input_python_stack_trace: string;
  output?: [string, outputType][];
  output_size?: number[];

  // Python type to show in CodeEditor
  output_type?: string;

  std_err: string;
  std_out: string;
  success: true;

  lineno: undefined;
}

export interface PythonError {
  std_out: string;
  std_err: string;

  output: undefined;
  output_type: undefined;
  array_output: undefined;

  success: false;
  input_python_stack_trace: string;
  line_number: number;
  formatted_code: string;

  lineno?: number;
}

export type PythonRun = PythonSuccess | PythonError;
