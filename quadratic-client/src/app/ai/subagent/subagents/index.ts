import { SubagentType } from '../SubagentType';
import type { BaseSubagent } from './BaseSubagent';
import { dataFinderSubagent } from './DataFinderSubagent';
import { connectionCoderSubagent, formulaCoderSubagent, javascriptCoderSubagent, pythonCoderSubagent } from './coding';

// Re-export base classes
export { BaseSubagent } from './BaseSubagent';
export { CodingSubagentBase } from './coding';

// Re-export subagent instances
export { dataFinderSubagent } from './DataFinderSubagent';
export { connectionCoderSubagent, formulaCoderSubagent, javascriptCoderSubagent, pythonCoderSubagent } from './coding';

/**
 * Registry of all subagent instances by type.
 * This is the single source of truth for subagent configurations.
 */
export const SUBAGENTS: Record<SubagentType, BaseSubagent> = {
  [SubagentType.DataFinder]: dataFinderSubagent,
  [SubagentType.FormulaCoder]: formulaCoderSubagent,
  [SubagentType.PythonCoder]: pythonCoderSubagent,
  [SubagentType.JavascriptCoder]: javascriptCoderSubagent,
  [SubagentType.ConnectionCoder]: connectionCoderSubagent,
};
