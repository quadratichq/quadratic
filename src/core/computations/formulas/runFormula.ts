export interface runFormulaReturnType {
    cells_accessed: [number, number][];
    success: boolean;
    error_span: [number, number] | null;
    error_msg: string | null;
    output_value: string | null;
    array_output: string[][] | null;
}
