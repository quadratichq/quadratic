import { BaseSubagent } from '../BaseSubagent';

/**
 * Abstract base class for coding subagents.
 * Provides shared configuration and prompt templates for code writing/debugging.
 */
export abstract class CodingSubagentBase extends BaseSubagent {
  /** Coding subagents get more iterations for debugging loops */
  override readonly maxIterations = 20;

  /** The programming language this subagent works with */
  protected abstract readonly language: string;

  /** The debug method for this language (e.g., 'print()' or 'console.log()') */
  protected abstract readonly debugMethod: string;

  /** Language-specific coding guidelines */
  protected abstract readonly languageGuidelines: string;

  /** Common task description for all coding subagents */
  protected get taskPrompt(): string {
    return `## Your Task
1. Read the task description and any data context provided
2. Write ${this.language} code that accomplishes the task
3. Keep iterating until the code runs successfully OR you need more guidance`;
  }

  /** Shared iterative debugging instructions */
  protected get iterativeDebuggingPrompt(): string {
    return `## Iterative Debugging
- Tool responses include console output (${this.debugMethod} statements) and errors
- Use ${this.debugMethod} statements to debug: inspect variables, check data shapes, trace execution
- After each attempt, analyze the output:
  - If successful: clean up debug statements and confirm completion
  - If error: analyze the error, add debug statements if needed, fix and retry
  - If stuck after 3-4 attempts: explain what you tried and ask for guidance
- Use rerun_code to re-execute and see updated console output`;
  }

  /** Common completion instructions */
  protected get completionPrompt(): string {
    return `## Completion
- When code works: remove debug ${this.debugMethod} statements, briefly describe what was done
- When stuck: explain what you tried and what help you need`;
  }

  /** Placement instructions for code cells */
  protected get placementPrompt(): string {
    return `## Code Placement
- The context hints should specify where to place the code (e.g., "Place at E1")
- Use the suggested placement location from context hints
- If you get a spill error (output overlaps existing data), use has_cell_data to find an empty area
- Charts output 7 columns x 23 rows by default - ensure the target area is clear
- Use has_cell_data to verify the target location is empty before placing code`;
  }

  /** Build the full system prompt from components */
  protected buildSystemPrompt(intro: string): string {
    return `${intro}

${this.taskPrompt}

${this.placementPrompt}

${this.iterativeDebuggingPrompt}

${this.languageGuidelines}

${this.completionPrompt}`;
  }
}
