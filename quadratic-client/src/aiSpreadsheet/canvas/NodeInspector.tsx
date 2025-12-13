import {
  aiSpreadsheetSelectedNodeAtom,
  aiSpreadsheetSelectedNodeIdAtom,
} from '@/aiSpreadsheet/atoms/aiSpreadsheetAtom';
import type { AiSpreadsheetNodeData } from '@/aiSpreadsheet/types';
import { Cross2Icon } from '@radix-ui/react-icons';
import { useRecoilState, useRecoilValue } from 'recoil';

export function NodeInspector() {
  const selectedNode = useRecoilValue(aiSpreadsheetSelectedNodeAtom);
  const [, setSelectedNodeId] = useRecoilState(aiSpreadsheetSelectedNodeIdAtom);

  if (!selectedNode) return null;

  const data = selectedNode.data as AiSpreadsheetNodeData;

  return (
    <div className="absolute bottom-4 right-4 z-10 w-80 rounded-lg border border-border bg-background shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${
              data.category === 'input'
                ? 'bg-yellow-500'
                : data.category === 'transform'
                  ? 'bg-blue-500'
                  : 'bg-pink-500'
            }`}
          />
          <h3 className="font-medium">{data.label}</h3>
        </div>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Cross2Icon className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-64 overflow-auto p-4">
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">Type:</span>{' '}
            <span className="font-medium capitalize">{data.nodeType}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Category:</span>{' '}
            <span className="font-medium capitalize">{data.category}</span>
          </div>

          {/* Render type-specific details */}
          {renderNodeDetails(data)}
        </div>
      </div>
    </div>
  );
}

function renderNodeDetails(data: AiSpreadsheetNodeData) {
  switch (data.nodeType) {
    case 'connection':
      return (
        <>
          <div>
            <span className="text-muted-foreground">Connection:</span>{' '}
            <span className="font-medium">{data.connectionName}</span>
          </div>
          {data.query && (
            <div>
              <span className="text-muted-foreground">Query:</span>
              <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">{data.query}</pre>
            </div>
          )}
        </>
      );

    case 'file':
      return (
        <>
          <div>
            <span className="text-muted-foreground">File:</span> <span className="font-medium">{data.fileName}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Type:</span> <span className="font-medium">{data.fileType}</span>
          </div>
        </>
      );

    case 'cell':
      return (
        <div>
          <span className="text-muted-foreground">Value:</span> <span className="font-medium">{data.value}</span>
        </div>
      );

    case 'webSearch':
      return (
        <div>
          <span className="text-muted-foreground">Query:</span> <span className="font-medium">{data.query}</span>
        </div>
      );

    case 'html':
      return (
        <div>
          <span className="text-muted-foreground">HTML:</span>
          <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">{data.htmlContent.slice(0, 200)}...</pre>
        </div>
      );

    case 'formula':
      return (
        <div>
          <span className="text-muted-foreground">Formula:</span>
          <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">{data.formula}</pre>
        </div>
      );

    case 'code':
      return (
        <>
          <div>
            <span className="text-muted-foreground">Language:</span>{' '}
            <span className="font-medium capitalize">{data.language}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Code:</span>
            <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">{data.code.slice(0, 300)}...</pre>
          </div>
        </>
      );

    case 'table':
      return (
        <>
          <div>
            <span className="text-muted-foreground">Columns:</span>{' '}
            <span className="font-medium">{data.columns.join(', ')}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Rows:</span>{' '}
            <span className="font-medium">{data.totalRows ?? data.rows.length}</span>
          </div>
        </>
      );

    case 'chart':
      return (
        <div>
          <span className="text-muted-foreground">Chart Type:</span>{' '}
          <span className="font-medium capitalize">{data.chartType}</span>
        </div>
      );

    case 'htmlOutput':
      return (
        <div>
          <span className="text-muted-foreground">Output:</span>
          <div
            className="mt-1 overflow-auto rounded border border-border bg-white p-2"
            dangerouslySetInnerHTML={{ __html: data.htmlContent.slice(0, 500) }}
          />
        </div>
      );

    default:
      return null;
  }
}
