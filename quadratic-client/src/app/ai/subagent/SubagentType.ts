/**
 * Types of subagents available for delegation.
 * Each subagent type has a specific purpose and set of allowed tools.
 *
 * This is in a separate file to avoid circular dependency issues
 * between subagentTypes.ts and the individual subagent files.
 */
export enum SubagentType {
  /** Finds, explores, and summarizes data in the spreadsheet */
  DataFinder = 'data_finder',
  /** Creates, edits, and debugs formula cells */
  FormulaCoder = 'formula_coder',
  /** Creates, edits, and debugs Python code cells */
  PythonCoder = 'python_coder',
  /** Creates, edits, and debugs JavaScript code cells */
  JavascriptCoder = 'javascript_coder',
  /** Creates, edits, and debugs SQL connection cells */
  ConnectionCoder = 'connection_coder',
}
