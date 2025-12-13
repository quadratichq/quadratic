/**
 * Hook for managing reactive code execution in the AI Spreadsheet.
 * When inputs change, dependent code nodes are re-executed automatically.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { aiSpreadsheetAtom } from '@/aiSpreadsheet/atoms/aiSpreadsheetAtom';
import type { AiSpreadsheetNode, CodeNodeData, BaseInputNodeData, CodeExecutionResult } from '@/aiSpreadsheet/types';
import { executePython, preloadPyodide, type InputValues } from '@/aiSpreadsheet/execution/pythonRunner';

// Debounce delay for re-execution (ms)
const EXECUTION_DEBOUNCE_MS = 300;

/**
 * Get all input nodes that a code node depends on (via edges)
 */
function getInputDependencies(
  codeNodeId: string,
  nodes: AiSpreadsheetNode[],
  edges: { source: string; target: string }[]
): AiSpreadsheetNode[] {
  // Find all edges that point TO this code node
  const incomingEdges = edges.filter((e) => e.target === codeNodeId);
  const sourceNodeIds = incomingEdges.map((e) => e.source);

  // Get the source nodes (inputs)
  return nodes.filter((n) => sourceNodeIds.includes(n.id) && n.data.category === 'input');
}

/**
 * Build input values map from input nodes
 */
function buildInputValues(inputNodes: AiSpreadsheetNode[]): InputValues {
  const values: InputValues = new Map();

  for (const node of inputNodes) {
    const data = node.data as BaseInputNodeData;
    const name = data.name;

    if (!name) continue;

    switch (data.nodeType) {
      case 'cell':
        values.set(name, (data as BaseInputNodeData & { value: string }).value || '');
        break;
      case 'dataTable': {
        const tableData = data as BaseInputNodeData & { columns: string[]; rows: string[][] };
        // Convert to 2D array with headers as first row
        const tableArray = [tableData.columns, ...tableData.rows];
        values.set(name, tableArray);
        break;
      }
      // Add other input types as needed
      default:
        console.warn(`[Execution] Unsupported input type: ${data.nodeType}`);
    }
  }

  return values;
}

/**
 * Hook to manage reactive code execution
 */
export function useExecutionEngine() {
  const [state, setState] = useRecoilState(aiSpreadsheetAtom);
  const executionQueueRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousInputValuesRef = useRef<Map<string, string>>(new Map());

  // Preload Pyodide on mount
  useEffect(() => {
    preloadPyodide();
  }, []);

  /**
   * Execute a single code node
   */
  const executeCodeNode = useCallback(
    async (nodeId: string) => {
      setState((prev) => {
        const node = prev.nodes.find((n) => n.id === nodeId);
        if (!node || node.data.nodeType !== 'code') return prev;

        // Set execution state to running
        return {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, executionState: 'running' } as CodeNodeData } : n
          ),
        };
      });

      // Get current state for execution
      const currentState = state;
      const node = currentState.nodes.find((n) => n.id === nodeId);

      if (!node || node.data.nodeType !== 'code') {
        console.warn('[Execution] Node not found or not a code node:', nodeId);
        return;
      }

      const codeData = node.data as CodeNodeData;

      // Only Python for now
      if (codeData.language !== 'python') {
        console.warn('[Execution] Only Python is supported currently');
        setState((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    executionState: 'error',
                    result: {
                      type: 'error',
                      error: 'Only Python is supported currently',
                      executedAt: Date.now(),
                    },
                  } as CodeNodeData,
                }
              : n
          ),
        }));
        return;
      }

      // Get input dependencies
      const inputNodes = getInputDependencies(nodeId, currentState.nodes, currentState.edges);
      const inputValues = buildInputValues(inputNodes);

      console.log('[Execution] Executing code node:', nodeId, {
        code: codeData.code.substring(0, 100),
        inputs: Array.from(inputValues.entries()),
      });

      // Execute the code with minimum animation time of 1 second
      const minAnimationTime = 1000;
      const startTime = Date.now();

      let result: CodeExecutionResult;
      try {
        result = await executePython(codeData.code, inputValues);
      } catch (error) {
        result = {
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
          executedAt: Date.now(),
        };
      }

      // Ensure minimum animation time
      const elapsed = Date.now() - startTime;
      if (elapsed < minAnimationTime) {
        await new Promise((resolve) => setTimeout(resolve, minAnimationTime - elapsed));
      }

      // Update node with result
      setState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  executionState: result.type === 'error' ? 'error' : 'success',
                  result,
                } as CodeNodeData,
              }
            : n
        ),
      }));

      console.log('[Execution] Execution complete:', nodeId, result.type);

      // Return the result so callers can check for errors
      return result;
    },
    [state, setState]
  );

  /**
   * Queue a code node for execution (debounced)
   */
  const queueExecution = useCallback(
    (nodeId: string) => {
      executionQueueRef.current.add(nodeId);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        const nodesToExecute = Array.from(executionQueueRef.current);
        executionQueueRef.current.clear();

        // Execute all queued nodes
        for (const id of nodesToExecute) {
          await executeCodeNode(id);
        }
      }, EXECUTION_DEBOUNCE_MS);
    },
    [executeCodeNode]
  );

  /**
   * Execute all code nodes that depend on a given input node
   */
  const executeDependentNodes = useCallback(
    (inputNodeId: string) => {
      // Find code nodes that have this input as a source
      const dependentCodeNodes = state.edges
        .filter((e) => e.source === inputNodeId)
        .map((e) => e.target)
        .filter((targetId) => {
          const node = state.nodes.find((n) => n.id === targetId);
          return node?.data.nodeType === 'code';
        });

      for (const codeNodeId of dependentCodeNodes) {
        queueExecution(codeNodeId);
      }
    },
    [state.nodes, state.edges, queueExecution]
  );

  /**
   * Execute all code nodes
   */
  const executeAllCodeNodes = useCallback(() => {
    const codeNodes = state.nodes.filter((n) => n.data.nodeType === 'code');
    for (const node of codeNodes) {
      queueExecution(node.id);
    }
  }, [state.nodes, queueExecution]);

  /**
   * Detect input changes and trigger re-execution
   */
  useEffect(() => {
    // Build current input values fingerprint
    const currentInputValues = new Map<string, string>();

    for (const node of state.nodes) {
      if (node.data.category !== 'input') continue;
      const data = node.data as BaseInputNodeData;
      const name = data.name;
      if (!name) continue;

      // Create a fingerprint of the input value
      let valueStr = '';
      if (data.nodeType === 'cell') {
        valueStr = (data as BaseInputNodeData & { value: string }).value || '';
      } else if (data.nodeType === 'dataTable') {
        const tableData = data as BaseInputNodeData & { columns: string[]; rows: string[][] };
        valueStr = JSON.stringify([tableData.columns, ...tableData.rows]);
      }

      currentInputValues.set(node.id, valueStr);
    }

    // Check for changes
    const changedInputIds: string[] = [];
    currentInputValues.forEach((value, nodeId) => {
      const previousValue = previousInputValuesRef.current.get(nodeId);
      if (previousValue !== value) {
        changedInputIds.push(nodeId);
      }
    });

    // Update previous values
    previousInputValuesRef.current = currentInputValues;

    // Execute dependent code nodes for changed inputs
    if (changedInputIds.length > 0) {
      console.log('[Execution] Input changes detected:', changedInputIds);
      for (const inputId of changedInputIds) {
        executeDependentNodes(inputId);
      }
    }
  }, [state.nodes, executeDependentNodes]);

  // Execute all code nodes when edges change (new connections)
  const previousEdgesRef = useRef<string>('');
  useEffect(() => {
    const edgesStr = JSON.stringify(state.edges.map((e) => `${e.source}->${e.target}`).sort());
    if (previousEdgesRef.current !== '' && previousEdgesRef.current !== edgesStr) {
      console.log('[Execution] Edges changed, re-executing all code nodes');
      executeAllCodeNodes();
    }
    previousEdgesRef.current = edgesStr;
  }, [state.edges, executeAllCodeNodes]);

  return {
    executeCodeNode,
    executeAllCodeNodes,
    executeDependentNodes,
  };
}
