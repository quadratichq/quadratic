import { SubagentType } from '../../SubagentType';
import { CodingSubagentBase } from './CodingSubagentBase';

/**
 * Python coder subagent.
 * Creates, edits, and debugs Python code cells.
 */
export class PythonCoderSubagent extends CodingSubagentBase {
  readonly type = SubagentType.PythonCoder;

  readonly description = 'Writing Python code';

  protected readonly language = 'Python';
  protected readonly debugMethod = 'print()';

  protected readonly languageGuidelines = `## Coding Guidelines
- Use q.cells() to reference spreadsheet data
- Return data using the last line of your code
- Use Plotly for charts (the only supported charting library)
- Consider output size when placing code cells (charts are 7x23 cells)
- Reference table names or A1 notation for data access
- IMPORTANT: Always use language "Python" when calling set_code_cell_value`;

  readonly systemPrompt = this.buildSystemPrompt(
    'You are a Python code assistant for Quadratic spreadsheets. Your job is to create, edit, and debug Python code cells until they work correctly.'
  );
}

export const pythonCoderSubagent = new PythonCoderSubagent();
