import { apiClient } from '@/shared/api/apiClient';
import type { DataAssetType } from 'quadratic-shared/typesAndSchemas';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { DataPickerDialog } from './DataPickerDialog';

// Types for data assets and connections
export interface DataAssetItem {
  uuid: string;
  name: string;
  type: DataAssetType;
  size: number;
  createdDate: string;
  updatedDate: string;
}

export interface ConnectionItem {
  uuid: string;
  name: string;
  type: string;
}

export type DataPickerResultType = 'data-asset' | 'connection' | 'uploaded';

// File content for AI chat (base64 encoded)
export interface DataAssetFileContent {
  name: string;
  mimeType: string;
  size: number;
  data: ArrayBuffer;
}

export interface DataPickerResult {
  type: DataPickerResultType;
  dataAsset?: DataAssetItem;
  connection?: ConnectionItem;
  /** File content if downloadContent option was set */
  fileContent?: DataAssetFileContent;
}

export interface DataPickerOptions {
  /** Filter by allowed data asset types */
  allowedTypes?: DataAssetType[];
  /** Allow selecting multiple items */
  allowMultiple?: boolean;
  /** Show upload option */
  allowUpload?: boolean;
  /** Show connections tab */
  showConnections?: boolean;
  /** Custom dialog title */
  title?: string;
  /** Initial tab to show */
  initialTab?: 'personal' | 'team' | 'connections';
  /** Download file content when selecting a data asset */
  downloadContent?: boolean;
}

// MIME type mapping for data asset types
const DATA_ASSET_MIME_TYPES: Record<DataAssetType, string> = {
  CSV: 'text/csv',
  EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PARQUET: 'application/vnd.apache.parquet',
  PDF: 'application/pdf',
  JSON: 'application/json',
  OTHER: 'application/octet-stream',
};

/** Download a data asset and return its content */
export async function downloadDataAssetContent(
  teamUuid: string,
  dataAsset: DataAssetItem
): Promise<DataAssetFileContent | null> {
  try {
    const { downloadUrl } = await apiClient.data.getDownloadUrl({ teamUuid, dataUuid: dataAsset.uuid });
    const response = await fetch(downloadUrl);
    const arrayBuffer = await response.arrayBuffer();

    return {
      name: dataAsset.name,
      mimeType: DATA_ASSET_MIME_TYPES[dataAsset.type] || 'application/octet-stream',
      size: dataAsset.size,
      data: arrayBuffer,
    };
  } catch (error) {
    console.error('Failed to download data asset:', error);
    return null;
  }
}

interface DataPickerContextType {
  /** Open the data picker dialog and await a result */
  open: (teamUuid: string, options?: DataPickerOptions) => Promise<DataPickerResult | null>;
  /** Whether the dialog is currently open */
  isOpen: boolean;
}

const DataPickerContext = createContext<DataPickerContextType | null>(null);

export function DataPickerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [teamUuid, setTeamUuid] = useState<string>('');
  const [options, setOptions] = useState<DataPickerOptions>({});
  const resolveRef = useRef<((result: DataPickerResult | null) => void) | null>(null);
  const optionsRef = useRef<DataPickerOptions>({});

  const open = useCallback((teamUuid: string, opts: DataPickerOptions = {}) => {
    return new Promise<DataPickerResult | null>((resolve) => {
      resolveRef.current = resolve;
      optionsRef.current = opts;
      setTeamUuid(teamUuid);
      setOptions(opts);
      setIsOpen(true);
    });
  }, []);

  const handleSelect = useCallback(
    async (result: DataPickerResult) => {
      // If downloadContent is enabled and we have a data asset, download the file
      if (optionsRef.current.downloadContent && result.dataAsset) {
        const fileContent = await downloadDataAssetContent(teamUuid, result.dataAsset);

        if (fileContent) {
          resolveRef.current?.({ ...result, fileContent });
        } else {
          // Download failed, still return the result without content
          resolveRef.current?.(result);
        }
      } else {
        resolveRef.current?.(result);
      }
      resolveRef.current = null;
      setIsOpen(false);
    },
    [teamUuid]
  );

  const handleCancel = useCallback(() => {
    resolveRef.current?.(null);
    resolveRef.current = null;
    setIsOpen(false);
  }, []);

  return (
    <DataPickerContext.Provider value={{ open, isOpen }}>
      {children}
      <DataPickerDialog
        open={isOpen}
        teamUuid={teamUuid}
        options={options}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />
    </DataPickerContext.Provider>
  );
}

/**
 * Hook for opening the data picker dialog.
 * Returns a promise that resolves to the selected data or null if cancelled.
 */
export function useDataPicker() {
  const context = useContext(DataPickerContext);
  if (!context) {
    throw new Error('useDataPicker must be used within DataPickerProvider');
  }
  return context;
}
