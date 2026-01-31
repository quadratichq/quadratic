import { SubagentType } from '../SubagentType';
import type { SubagentConfig } from '../subagentTypes';
import { dataFinderSubagent } from './DataFinderSubagent';
import { connectionCoderSubagent, formulaCoderSubagent, javascriptCoderSubagent, pythonCoderSubagent } from './coding';

// Re-export base classes
export { BaseSubagent } from './BaseSubagent';
export { CodingSubagentBase } from './coding';

// Re-export subagent instances
export { dataFinderSubagent } from './DataFinderSubagent';
export { connectionCoderSubagent, formulaCoderSubagent, javascriptCoderSubagent, pythonCoderSubagent } from './coding';

/**
 * Configuration for all subagent types.
 * Aggregates configs from individual subagent classes.
 */
export const SUBAGENT_CONFIGS: Record<SubagentType, SubagentConfig> = {
  [SubagentType.DataFinder]: dataFinderSubagent.getConfig(),
  [SubagentType.FormulaCoder]: formulaCoderSubagent.getConfig(),
  [SubagentType.PythonCoder]: pythonCoderSubagent.getConfig(),
  [SubagentType.JavascriptCoder]: javascriptCoderSubagent.getConfig(),
  [SubagentType.ConnectionCoder]: connectionCoderSubagent.getConfig(),
};
