import { useExecution } from '@/aiSpreadsheet/execution/ExecutionContext';
import type { CodeExecutionResult, CodeNodeData } from '@/aiSpreadsheet/types';
import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { CodeIcon, FunctionIcon, RefreshIcon } from '@/shared/components/Icons';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

// Result display component
function ResultDisplay({ result, compact = false }: { result: CodeExecutionResult; compact?: boolean }) {
  if (result.type === 'error') {
    return (
      <div className={`rounded border border-red-300 bg-red-50 p-2 ${compact ? 'mt-2' : ''}`}>
        <div className="text-xs font-medium text-red-700">Error</div>
        <div className="mt-1 font-mono text-xs text-red-600">{result.error}</div>
      </div>
    );
  }

  if (result.type === 'value') {
    return (
      <div className={`rounded border border-emerald-300 bg-emerald-50 p-2 ${compact ? 'mt-2' : ''}`}>
        <div className="text-xs font-medium text-emerald-700">Result</div>
        <div className="mt-1 font-mono text-sm font-semibold text-emerald-800">{String(result.value)}</div>
      </div>
    );
  }

  if (result.type === 'table' && result.columns && result.rows) {
    return (
      <div className={`max-h-96 overflow-auto rounded border border-emerald-300 bg-white ${compact ? 'mt-2' : ''}`}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-emerald-100">
            <tr>
              {result.columns.map((col, i) => (
                <th key={i} className="px-2 py-1 text-left font-medium text-emerald-800">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-emerald-50/50'}>
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1 text-slate-700">
                    {String(cell ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (result.type === 'html' && result.htmlContent) {
    return (
      <div className={`overflow-hidden rounded border border-purple-300 bg-white ${compact ? 'mt-2' : ''}`}>
        <div className="max-h-48 overflow-auto p-2" dangerouslySetInnerHTML={{ __html: result.htmlContent }} />
      </div>
    );
  }

  if (result.type === 'chart' && result.htmlContent) {
    return (
      <div className={`overflow-hidden rounded border border-purple-300 bg-white ${compact ? 'mt-2' : ''}`}>
        <div className="chart-container" dangerouslySetInnerHTML={{ __html: result.htmlContent }} />
      </div>
    );
  }

  return null;
}

// Helper to get handle color class
function getHandleColorClass(hasError: boolean, hasResult: boolean): string {
  if (hasError) return '!border-red-600 !bg-red-400';
  if (hasResult) return '!border-emerald-600 !bg-emerald-400';
  return '!border-blue-600 !bg-blue-400';
}

// Parse code and generate explanation sections
function generateCodeExplanation(code: string, description?: string): { sections: CodeSection[]; inputs: string[] } {
  const lines = code.split('\n');
  const sections: CodeSection[] = [];
  const inputs: string[] = [];

  // Extract q.get() calls
  const qGetMatches = code.matchAll(/q\.get\(['"]([^'"]+)['"]\)/g);
  for (const match of qGetMatches) {
    inputs.push(match[1]);
  }

  // Group lines into logical sections
  let currentSection: CodeSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      if (currentSection) {
        sections.push(currentSection);
        currentSection = null;
      }
      continue;
    }

    // Skip comments but use them as section headers
    if (trimmed.startsWith('#')) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        title: trimmed.replace(/^#+\s*/, ''),
        code: [],
        explanation: '',
      };
      continue;
    }

    // Import statements
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      if (!currentSection || currentSection.title !== 'Imports') {
        if (currentSection) sections.push(currentSection);
        currentSection = { title: 'Imports', code: [], explanation: 'Loading required libraries' };
      }
      currentSection.code.push(line);
      continue;
    }

    // q.get() calls - Input retrieval
    if (trimmed.includes('q.get(')) {
      if (!currentSection || currentSection.title !== 'Input Values') {
        if (currentSection) sections.push(currentSection);
        currentSection = {
          title: 'Input Values',
          code: [],
          explanation: 'Reading values from connected input cells',
        };
      }
      currentSection.code.push(line);
      continue;
    }

    // Variable assignments with calculations
    if (trimmed.match(/^\w+\s*=/) && !trimmed.includes('q.get(')) {
      if (!currentSection || currentSection.title === 'Imports' || currentSection.title === 'Input Values') {
        if (currentSection) sections.push(currentSection);
        currentSection = { title: 'Calculations', code: [], explanation: 'Computing values based on inputs' };
      }
      currentSection.code.push(line);
      continue;
    }

    // DataFrame or return value
    if (
      trimmed.startsWith('pd.DataFrame') ||
      trimmed.startsWith('DataFrame') ||
      trimmed.match(/^f["']/) ||
      trimmed.match(/^\$/)
    ) {
      if (!currentSection || currentSection.title !== 'Output') {
        if (currentSection) sections.push(currentSection);
        currentSection = { title: 'Output', code: [], explanation: 'Formatting the final result' };
      }
      currentSection.code.push(line);
      continue;
    }

    // Add to current section or create generic one
    if (!currentSection) {
      currentSection = { title: 'Code', code: [], explanation: '' };
    }
    currentSection.code.push(line);
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return { sections, inputs };
}

interface CodeSection {
  title: string;
  code: string[];
  explanation: string;
}

// Generate smart bullet points explaining the code
function generateSmartBulletPoints(code: string, inputs: string[]): string[] {
  const bullets: string[] = [];

  // Analyze imports
  const importMatches = code.match(/(?:import|from)\s+(\w+)/g);
  if (importMatches) {
    const libs = [...new Set(importMatches.map((m) => m.replace(/(?:import|from)\s+/, '')))];
    if (libs.includes('pandas') || libs.includes('pd')) {
      bullets.push('Uses pandas for data manipulation and table creation');
    }
    if (libs.includes('numpy') || libs.includes('np')) {
      bullets.push('Uses NumPy for numerical computations');
    }
    if (libs.includes('plotly')) {
      bullets.push('Creates interactive visualizations with Plotly');
    }
    if (libs.includes('matplotlib')) {
      bullets.push('Generates charts using Matplotlib');
    }
  }

  // Describe inputs
  if (inputs.length > 0) {
    if (inputs.length === 1) {
      bullets.push(`Reads the "${inputs[0]}" input value`);
    } else if (inputs.length <= 3) {
      bullets.push(`Takes ${inputs.length} inputs: ${inputs.map((i) => `"${i}"`).join(', ')}`);
    } else {
      bullets.push(`Processes ${inputs.length} different input values`);
    }
  }

  // Analyze calculations
  if (code.includes('**') || code.includes('pow(')) {
    bullets.push('Performs exponential/power calculations');
  }
  if (code.match(/[+\-*/]\s*[\d\w]/)) {
    bullets.push('Calculates derived values from inputs');
  }
  if (code.includes('if ') || code.includes('else:')) {
    bullets.push('Includes conditional logic for different scenarios');
  }
  if (code.includes('for ') || code.includes('while ')) {
    bullets.push('Iterates through data using loops');
  }

  // Analyze output type
  if (code.includes('pd.DataFrame') || code.includes('DataFrame(')) {
    bullets.push('Returns results as a formatted table');
  } else if (code.includes('plotly') || code.includes('px.') || code.includes('go.')) {
    bullets.push('Outputs an interactive chart or visualization');
  } else if (code.match(/f["'].*\$|\.format\(|%/)) {
    bullets.push('Formats the result as a readable string');
  }

  // Common patterns
  if (code.includes('sum(') || code.includes('.sum()')) {
    bullets.push('Calculates a sum total');
  }
  if (code.includes('mean(') || code.includes('.mean()') || code.includes('average')) {
    bullets.push('Computes an average/mean value');
  }
  if (code.includes('.groupby(')) {
    bullets.push('Groups and aggregates data by categories');
  }
  if (code.includes('.merge(') || code.includes('.join(')) {
    bullets.push('Combines multiple data sources');
  }

  // If we couldn't generate meaningful bullets, add a generic one
  if (bullets.length === 0) {
    bullets.push('Processes input values and computes a result');
  }

  return bullets;
}

// Fetch AI explanation from API
async function fetchAIExplanation(code: string, description?: string): Promise<string[]> {
  try {
    const token = await authClient.getTokenOrRedirect();
    const endpoint = `${apiClient.getApiUrl()}/v0/ai/chat`;

    const prompt = `Explain this Python code in 3-5 simple bullet points. Each bullet should be a short, clear sentence that a non-programmer could understand. Focus on WHAT the code does, not HOW it does it.

${description ? `Context: ${description}\n\n` : ''}Code:
\`\`\`python
${code}
\`\`\`

Return ONLY the bullet points, one per line, starting with "• ". No other text.`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        modelKey: 'anthropic:claude-sonnet',
        useStream: false,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch explanation');
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || data.message || '';

    // Parse bullet points from response
    const bullets = text
      .split('\n')
      .filter((line: string) => line.trim().startsWith('•') || line.trim().startsWith('-'))
      .map((line: string) => line.replace(/^[•-]\s*/, '').trim())
      .filter((line: string) => line.length > 0);

    return bullets.length > 0 ? bullets : ['Could not generate explanation'];
  } catch (error) {
    console.error('Error fetching AI explanation:', error);
    return ['Could not generate AI explanation'];
  }
}

// Expanded view tabs
type ExpandedTab = 'explanation' | 'code';

// Expanded Code Cell Panel
function ExpandedCodePanel({
  nodeData,
  onClose,
  onRerun,
  isRunning,
}: {
  nodeData: CodeNodeData;
  onClose: () => void;
  onRerun: () => void;
  isRunning: boolean;
}) {
  const [activeTab, setActiveTab] = useState<ExpandedTab>('explanation');
  const [aiExplanation, setAiExplanation] = useState<string[] | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const { sections, inputs } = useMemo(
    () => generateCodeExplanation(nodeData.code, nodeData.description),
    [nodeData.code, nodeData.description]
  );

  // Generate smart bullet points
  const smartBullets = useMemo(() => generateSmartBulletPoints(nodeData.code, inputs), [nodeData.code, inputs]);

  // Fetch AI explanation on mount
  useEffect(() => {
    let cancelled = false;
    setIsLoadingAI(true);
    fetchAIExplanation(nodeData.code, nodeData.description).then((bullets) => {
      if (!cancelled) {
        setAiExplanation(bullets);
        setIsLoadingAI(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [nodeData.code, nodeData.description]);

  const hasError = nodeData.executionState === 'error';
  const hasResult = nodeData.result !== undefined;

  // Determine header color
  let headerBgClass = 'bg-blue-600';
  if (hasError) {
    headerBgClass = 'bg-red-600';
  } else if (hasResult && nodeData.result?.type !== 'error') {
    headerBgClass = 'bg-emerald-600';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-8">
      <div className="flex h-full max-h-[800px] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className={`flex items-center gap-3 px-4 py-3 text-white ${headerBgClass}`}>
          <CodeIcon size="sm" />
          <span className="text-lg font-semibold">{nodeData.label}</span>
          {isRunning && (
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span className="text-sm opacity-90">Running...</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onRerun}
              disabled={isRunning}
              className="flex items-center gap-1.5 rounded-md bg-white/20 px-3 py-1.5 text-sm transition-colors hover:bg-white/30 disabled:opacity-50"
            >
              <RefreshIcon className="h-4 w-4" />
              Re-run
            </button>
            <span className="rounded bg-white/20 px-2 py-1 text-sm">
              {nodeData.language === 'python' ? 'Python' : 'JavaScript'}
            </span>
            <button
              onClick={onClose}
              className="ml-2 rounded-md p-1.5 transition-colors hover:bg-white/20"
              title="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setActiveTab('explanation')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'explanation'
                ? 'border-b-2 border-blue-500 bg-white text-blue-600'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              AI Explanation
            </span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'code'
                ? 'border-b-2 border-blue-500 bg-white text-blue-600'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
              Code & Output
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'explanation' ? (
            <div className="p-6">
              {/* What This Code Does - AI Bullet Points */}
              <div className="mb-6 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  <h3 className="text-base font-semibold text-blue-800">What This Code Does</h3>
                  {isLoadingAI && (
                    <div className="ml-2 flex items-center gap-1.5 text-xs text-blue-600">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      AI analyzing...
                    </div>
                  )}
                </div>

                {/* Show description if available */}
                {nodeData.description && (
                  <p className="mb-4 text-sm leading-relaxed text-blue-700">{nodeData.description}</p>
                )}

                {/* AI-generated bullet points */}
                <ul className="space-y-2">
                  {(aiExplanation || smartBullets).map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                      <span className="text-sm leading-relaxed text-blue-800">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Inputs used */}
              {inputs.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Inputs Used</h3>
                  <div className="flex flex-wrap gap-2">
                    {inputs.map((input, i) => (
                      <span key={i} className="rounded-full bg-amber-100 px-3 py-1 font-mono text-xs text-amber-800">
                        {input}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Code sections breakdown */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Code Breakdown</h3>
                {sections.map((section, i) => (
                  <div key={i} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between bg-slate-100 px-4 py-2">
                      <span className="text-sm font-medium text-slate-700">{section.title}</span>
                      {section.explanation && <span className="text-xs text-slate-500">{section.explanation}</span>}
                    </div>
                    <pre className="overflow-x-auto bg-slate-900 p-4 font-mono text-xs text-slate-100">
                      {section.code.join('\n')}
                    </pre>
                  </div>
                ))}
              </div>

              {/* Result preview */}
              {hasResult && nodeData.result && (
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Result</h3>
                  <ResultDisplay result={nodeData.result} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {/* Full code */}
              <div className="flex-1 overflow-auto border-b border-slate-200">
                <div className="sticky top-0 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-400">
                  Source Code
                </div>
                <pre className="overflow-x-auto bg-slate-900 p-4 font-mono text-sm leading-relaxed text-slate-100">
                  {nodeData.code}
                </pre>
              </div>

              {/* Output section */}
              <div className="max-h-72 overflow-auto bg-slate-50">
                {/* stdout */}
                {nodeData.result?.stdout && (
                  <div className="border-b border-slate-200">
                    <div className="sticky top-0 bg-slate-200 px-4 py-2 text-xs font-medium text-slate-600">
                      Console Output (stdout)
                    </div>
                    <pre className="whitespace-pre-wrap bg-slate-100 p-4 font-mono text-xs text-slate-700">
                      {nodeData.result.stdout}
                    </pre>
                  </div>
                )}

                {/* stderr / error */}
                {nodeData.result?.type === 'error' && nodeData.result.error && (
                  <div>
                    <div className="sticky top-0 bg-red-200 px-4 py-2 text-xs font-medium text-red-700">
                      Error Output (stderr)
                    </div>
                    <pre className="whitespace-pre-wrap bg-red-50 p-4 font-mono text-xs text-red-600">
                      {nodeData.result.error}
                    </pre>
                  </div>
                )}

                {/* Result */}
                {hasResult && nodeData.result && nodeData.result.type !== 'error' && (
                  <div className="p-4">
                    <div className="mb-2 text-xs font-medium text-slate-600">Execution Result</div>
                    <ResultDisplay result={nodeData.result} />
                  </div>
                )}

                {/* No output message */}
                {!nodeData.result?.stdout && nodeData.result?.type !== 'error' && !hasResult && (
                  <div className="p-4 text-center text-sm text-slate-400">No console output</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TransformNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as CodeNodeData;
  const { executeCodeNode } = useExecution();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleRerun = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      executeCodeNode(id);
    },
    [executeCodeNode, id]
  );

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(true);
  }, []);

  const handleCloseExpanded = useCallback(() => {
    setIsExpanded(false);
  }, []);

  // Only handle code nodes (formula nodes are skipped for now)
  if (nodeData.nodeType !== 'code') {
    return (
      <div
        className={`relative min-w-[280px] rounded-lg border-2 bg-slate-50 shadow-md ${
          selected ? 'border-slate-600 shadow-lg ring-2 ring-slate-300' : 'border-slate-400'
        }`}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-slate-600 !bg-slate-400"
        />
        <div className="flex items-center gap-2 rounded-t-md bg-slate-500 px-3 py-2 text-white">
          <FunctionIcon size="sm" />
          <span className="font-semibold">{nodeData.label}</span>
        </div>
        <div className="px-3 py-2 text-xs text-slate-600">Formula (coming soon)</div>
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-slate-600 !bg-slate-400"
        />
      </div>
    );
  }

  const getCodePreview = () => {
    const lines = nodeData.code.split('\n').slice(0, 3);
    return lines.map((line) => (line.length > 40 ? line.slice(0, 40) + '...' : line)).join('\n');
  };

  const isRunning = nodeData.executionState === 'running';
  const hasResult = nodeData.result !== undefined;
  const hasError = nodeData.executionState === 'error';

  // Determine border color based on state
  let borderClass = 'border-blue-400';
  let headerBgClass = 'bg-blue-500';
  if (selected) {
    borderClass = 'border-blue-600 ring-2 ring-blue-300';
  }
  if (hasError) {
    borderClass = selected ? 'border-red-600 ring-2 ring-red-300' : 'border-red-400';
    headerBgClass = 'bg-red-500';
  } else if (hasResult && nodeData.result?.type !== 'error') {
    borderClass = selected ? 'border-emerald-600 ring-2 ring-emerald-300' : 'border-emerald-400';
    headerBgClass = 'bg-emerald-500';
  }

  const handleColorClass = getHandleColorClass(hasError, hasResult && nodeData.result?.type !== 'error');

  return (
    <>
      {/* Expanded panel - rendered via portal to escape React Flow transform */}
      {isExpanded &&
        createPortal(
          <ExpandedCodePanel
            nodeData={nodeData}
            onClose={handleCloseExpanded}
            onRerun={handleRerun}
            isRunning={isRunning}
          />,
          document.body
        )}

      {/* Compact node */}
      <div
        className={`relative min-w-[280px] rounded-lg border-2 bg-white shadow-md transition-all ${borderClass}`}
        onDoubleClick={handleDoubleClick}
      >
        {/* Input handle on the left */}
        <Handle type="target" position={Position.Left} className={`!h-3 !w-3 !border-2 ${handleColorClass}`} />

        {/* Header */}
        <div className={`flex items-center gap-2 rounded-t-md px-3 py-2 text-white ${headerBgClass}`}>
          <CodeIcon size="sm" />
          <span className="font-semibold">{nodeData.label}</span>
          {isRunning && (
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span className="text-xs opacity-90">Running...</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
              className="rounded p-1 transition-colors hover:bg-white/20"
              title="Expand"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
            <button
              onClick={handleRerun}
              disabled={isRunning}
              className="rounded p-1 transition-colors hover:bg-white/20 disabled:opacity-50"
              title="Re-run code"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
            </button>
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs">
              {nodeData.language === 'python' ? 'Python' : 'JS'}
            </span>
          </div>
        </div>

        {/* Description or Code preview */}
        <div className="cursor-pointer border-b border-slate-200 bg-slate-50 px-3 py-2" title="Double-click to expand">
          {nodeData.description ? (
            <p className="text-sm leading-relaxed text-slate-700">{nodeData.description}</p>
          ) : (
            <pre className="overflow-hidden font-mono text-xs text-slate-700">{getCodePreview()}</pre>
          )}
        </div>

        {/* Execution state and result */}
        <div className="px-3 py-2">
          {hasResult && nodeData.result && <ResultDisplay result={nodeData.result} compact />}
          {!hasResult && !isRunning && <div className="text-xs italic text-slate-400">Not yet executed</div>}
          {nodeData.result?.stdout && (
            <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2">
              <div className="text-xs font-medium text-slate-500">Console</div>
              <pre className="mt-1 max-h-20 overflow-auto font-mono text-xs text-slate-600">
                {nodeData.result.stdout}
              </pre>
            </div>
          )}
        </div>

        {/* Output handle on the right */}
        <Handle type="source" position={Position.Right} className={`!h-3 !w-3 !border-2 ${handleColorClass}`} />
      </div>
    </>
  );
}
