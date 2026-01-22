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

export interface DataPickerResult {
  type: DataPickerResultType;
  dataAsset?: DataAssetItem;
  connection?: ConnectionItem;
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

  const open = useCallback((teamUuid: string, opts: DataPickerOptions = {}) => {
    return new Promise<DataPickerResult | null>((resolve) => {
      resolveRef.current = resolve;
      setTeamUuid(teamUuid);
      setOptions(opts);
      setIsOpen(true);
    });
  }, []);

  const handleSelect = useCallback((result: DataPickerResult) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setIsOpen(false);
  }, []);

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
