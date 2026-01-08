import { FileIcon } from '@/shared/components/Icons';
import { cn } from '@/shared/shadcn/utils';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

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

interface ParsedSheetData {
  name: string;
  headers: string[];
  rows: string[][];
  totalRows: number;
  totalColumns: number;
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

function getCellValue(cell: XLSX.CellObject | undefined): string {
  if (!cell) return '';
  
  // Use formatted text if available (w property)
  if (cell.w !== undefined) return cell.w;
  
  // Fall back to raw value (v property) - this is the calculated result for formulas
  if (cell.v !== undefined) {
    if (cell.t === 'n') {
      // Number - format it nicely
      const num = cell.v as number;
      if (Number.isInteger(num)) return num.toLocaleString();
      return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    if (cell.t === 'b') return cell.v ? 'TRUE' : 'FALSE'; // Boolean
    if (cell.t === 'd') {
      // Date
      const date = cell.v as Date;
      return date.toLocaleDateString();
    }
    return String(cell.v);
  }
  
  // If there's a formula but no cached value, show formula indicator
  if (cell.f) return `=${cell.f.substring(0, 20)}${cell.f.length > 20 ? '…' : ''}`;
  
  return '';
}

function parseExcelSheet(worksheet: XLSX.WorkSheet): Omit<ParsedSheetData, 'name'> {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const totalRows = Math.max(0, range.e.r); // Exclude header row from count
  const totalColumns = range.e.c + 1;
  
  if (totalRows === 0 && totalColumns === 0) {
    return { headers: [], rows: [], totalRows: 0, totalColumns: 0 };
  }

  // Get headers from first row
  const headers: string[] = [];
  for (let col = 0; col <= Math.min(range.e.c, MAX_PREVIEW_COLS - 1); col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = worksheet[cellAddress];
    headers.push(getCellValue(cell));
  }

  // Get data rows
  const rows: string[][] = [];
  for (let row = 1; row <= Math.min(range.e.r, MAX_PREVIEW_ROWS); row++) {
    const rowData: string[] = [];
    for (let col = 0; col <= Math.min(range.e.c, MAX_PREVIEW_COLS - 1); col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      rowData.push(getCellValue(cell));
    }
    rows.push(rowData);
  }

  return {
    headers: headers.slice(0, MAX_PREVIEW_COLS),
    rows,
    totalRows,
    totalColumns,
  };
}

function parseExcel(data: ArrayBuffer): ParsedSheetData[] {
  // cellFormula preserves formula info, cellDates parses dates properly
  const workbook = XLSX.read(data, { 
    type: 'array', 
    cellDates: true, 
    cellNF: true,
    cellFormula: true,  // Keep formula info
  });
  const sheets: ParsedSheetData[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const sheetData = parseExcelSheet(worksheet);
    sheets.push({
      name: sheetName,
      ...sheetData,
    });
  }

  return sheets;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Table component for displaying sheet data
const DataTable = memo(({ data }: { data: ParsedData | ParsedSheetData }) => (
  <div className="space-y-3">
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50">
            {data.headers.map((header, i) => (
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
          {data.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-muted/30">
              {data.headers.map((_, colIndex) => (
                <td
                  key={colIndex}
                  className="whitespace-nowrap border-b border-r border-border px-3 py-1.5 last:border-r-0"
                >
                  <span className="block max-w-[120px] truncate text-foreground/80">{row[colIndex] || ''}</span>
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
        {data.totalRows} row{data.totalRows !== 1 ? 's' : ''}
      </span>
      <span>·</span>
      <span>
        {data.totalColumns} column{data.totalColumns !== 1 ? 's' : ''}
      </span>
    </div>
  </div>
));

DataTable.displayName = 'DataTable';

export const FilePreview = memo(({ file, className }: FilePreviewProps) => {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [excelSheets, setExcelSheets] = useState<ParsedSheetData[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
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
      setParsedData(null);
      setExcelSheets([]);
      setActiveSheetIndex(0);

      try {
        if (isCSV) {
          const decoder = new TextDecoder('utf-8');
          const content = decoder.decode(file.data);
          const parsed = parseCSV(content);
          setParsedData(parsed);
        } else if (isExcel) {
          const sheets = parseExcel(file.data);
          setExcelSheets(sheets);
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

  const handleSheetClick = useCallback((index: number) => {
    setActiveSheetIndex(index);
  }, []);

  const activeSheet = excelSheets[activeSheetIndex];
  const hasData = parsedData?.headers.length || activeSheet?.headers.length;

  return (
    <div
      className={cn('flex flex-col rounded-lg border border-border bg-card/50 backdrop-blur-sm', className)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        {isExcel ? (
          <img src="/images/icon-excel.svg" alt="Excel" className="h-6 w-6" />
        ) : (
          <FileIcon size="md" className="text-foreground/70" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            (Preview) {file.name}
          </p>
          <p className="text-xs text-foreground/60">{formatFileSize(file.size)}</p>
        </div>
      </div>

      {/* Sheet Tabs for Excel */}
      {isExcel && excelSheets.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-muted/30 px-2 py-1">
          {excelSheets.map((sheet, index) => (
            <button
              key={index}
              onClick={() => handleSheetClick(index)}
              className={cn(
                'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                index === activeSheetIndex
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-foreground/60 hover:bg-background/50 hover:text-foreground'
              )}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="overflow-auto p-4">
        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-foreground/70">{error}</div>
        ) : parsedData && parsedData.headers.length > 0 ? (
          <DataTable data={parsedData} />
        ) : activeSheet && activeSheet.headers.length > 0 ? (
          <DataTable data={activeSheet} />
        ) : hasData === 0 && (isCSV || isExcel) ? (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-foreground/70">
            No data in {isExcel && activeSheet ? `"${activeSheet.name}"` : 'this file'}
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
