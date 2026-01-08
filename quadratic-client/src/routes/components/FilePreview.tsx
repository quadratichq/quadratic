import { FileIcon } from '@/shared/components/Icons';
import { cn } from '@/shared/shadcn/utils';
import { memo, useEffect, useMemo, useState } from 'react';

interface UploadedFile {
  name: string;
  size: number;
  data: ArrayBuffer;
  type: string;
}

interface FilePreviewProps {
  file: UploadedFile;
  className?: string;
}

interface ParsedData {
  headers: string[];
  rows: string[][];
  totalRows: number;
  totalColumns: number;
}

const MAX_PREVIEW_ROWS = 12;
const MAX_PREVIEW_COLS = 10;

function parseCSV(content: string): ParsedData {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0, totalColumns: 0 };
  }

  // Simple CSV parsing (handles basic cases)
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const allRows = lines.map(parseLine);
  const headers = allRows[0] || [];
  const dataRows = allRows.slice(1);

  return {
    headers: headers.slice(0, MAX_PREVIEW_COLS),
    rows: dataRows.slice(0, MAX_PREVIEW_ROWS).map((row) => row.slice(0, MAX_PREVIEW_COLS)),
    totalRows: dataRows.length,
    totalColumns: headers.length,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const FilePreview = memo(({ file, className }: FilePreviewProps) => {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCSV = useMemo(() => {
    const ext = file.name.toLowerCase();
    return ext.endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/csv';
  }, [file]);

  const isExcel = useMemo(() => {
    const ext = file.name.toLowerCase();
    return ext.endsWith('.xlsx') || ext.endsWith('.xls');
  }, [file]);

  useEffect(() => {
    const parseFile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (isCSV) {
          const decoder = new TextDecoder('utf-8');
          const content = decoder.decode(file.data);
          const parsed = parseCSV(content);
          setParsedData(parsed);
        } else if (isExcel) {
          // For Excel files, we can't easily parse without a library
          // Show a placeholder with file info
          setParsedData(null);
        }
      } catch (err) {
        console.error('Error parsing file:', err);
        setError('Unable to preview file');
      } finally {
        setIsLoading(false);
      }
    };

    parseFile();
  }, [file, isCSV, isExcel]);

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-border bg-card/50 backdrop-blur-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        {isExcel ? (
          <img src="/images/icon-excel.svg" alt="Excel" className="h-6 w-6" />
        ) : (
          <FileIcon size="md" className="text-foreground/70" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
          <p className="text-xs text-foreground/60">{formatFileSize(file.size)}</p>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-auto p-4">
        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-foreground/70">{error}</div>
        ) : parsedData && parsedData.headers.length > 0 ? (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    {parsedData.headers.map((header, i) => (
                      <th
                        key={i}
                        className="whitespace-nowrap border-b border-r border-border px-3 py-2 text-left font-medium text-foreground last:border-r-0"
                      >
                        <span className="block max-w-[120px] truncate">{header || `Column ${i + 1}`}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-muted/30">
                      {parsedData.headers.map((_, colIndex) => (
                        <td
                          key={colIndex}
                          className="whitespace-nowrap border-b border-r border-border px-3 py-1.5 last:border-r-0"
                        >
                          <span className="block max-w-[120px] truncate text-foreground/80">
                            {row[colIndex] || ''}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/70">
              <span>
                {parsedData.totalRows} row{parsedData.totalRows !== 1 ? 's' : ''}
              </span>
              <span>·</span>
              <span>
                {parsedData.totalColumns} column{parsedData.totalColumns !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        ) : isExcel ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10">
              <img src="/images/icon-excel.svg" alt="Excel" className="h-10 w-10" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Excel file ready</p>
              <p className="mt-1 text-xs text-foreground/60">
                Your Excel data will be imported when you create the spreadsheet
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-foreground/70">
            No data to preview
          </div>
        )}
      </div>
    </div>
  );
});

FilePreview.displayName = 'FilePreview';

