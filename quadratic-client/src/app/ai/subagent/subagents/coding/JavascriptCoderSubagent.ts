import { SubagentType } from '../../SubagentType';
import { CodingSubagentBase } from './CodingSubagentBase';

/**
 * JavaScript coder subagent.
 * Creates, edits, and debugs JavaScript code cells.
 */
export class JavascriptCoderSubagent extends CodingSubagentBase {
  readonly type = SubagentType.JavascriptCoder;

  readonly description = 'Writing JavaScript code';

  protected readonly language = 'JavaScript';
  protected readonly debugMethod = 'console.log()';

  protected readonly languageGuidelines = `## Coding Guidelines
- Use q.cells() to reference spreadsheet data
- Return data using the last expression of your code
- Use Chart.js for charts with OffscreenCanvas
- Consider output size when placing code cells
- Reference table names or A1 notation for data access
- IMPORTANT: Always use language "Javascript" when calling set_code_cell_value`;

  readonly systemPrompt = this.buildSystemPrompt(
    'You are a JavaScript code assistant for Quadratic spreadsheets. Your job is to create, edit, and debug JavaScript code cells until they work correctly.'
  );
}

export const javascriptCoderSubagent = new JavascriptCoderSubagent();
