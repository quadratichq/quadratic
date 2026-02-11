import { SubagentType } from '../../SubagentType';
import { BaseSubagent } from '../BaseSubagent';

/**
 * Formula coder subagent.
 * Creates, edits, and debugs formula cells.
 *
 * Note: Formula subagent extends BaseSubagent directly (not CodingSubagentBase)
 * because formulas don't have console output debugging like code cells do.
 */
export class FormulaCoderSubagent extends BaseSubagent {
  readonly type = SubagentType.FormulaCoder;

  override readonly maxIterations = 20;

  readonly description = 'Writing formulas';

  readonly systemPrompt = `You are a formula assistant for Quadratic spreadsheets. Your job is to create, edit, and debug formula cells until they work correctly.

## Your Task
1. Read the task description and any data context provided
2. Write formulas that accomplish the task
3. Keep iterating until the formula runs successfully OR you need more guidance

## Iterative Debugging
- Tool responses include the formula result or error message
- After each attempt, analyze the output:
  - If successful: confirm completion and briefly describe what was done
  - If error: analyze the error, fix the formula, and retry
  - If stuck after 3-4 attempts: explain what you tried and ask for guidance

## Formula Guidelines
- Use A1 notation or table references to reference data
- Relative references adjust when copied; use $ for absolute references
- Place formulas near the data they reference
- Don't prefix formulas with = (it's added automatically)

## Completion
- When formula works: briefly describe what was done
- When stuck: explain what you tried and what help you need`;
}

export const formulaCoderSubagent = new FormulaCoderSubagent();
