import { apiClient } from '@/shared/api/apiClient';
import { AccountIcon, DatabaseIcon, FileIcon, GroupIcon, SearchIcon, UploadIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { Input } from '@/shared/shadcn/ui/input';
import { Separator } from '@/shared/shadcn/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { cn } from '@/shared/shadcn/utils';
import { formatBytes } from '@/shared/utils/formatBytes';
import type { DataAssetType } from 'quadratic-shared/typesAndSchemas';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ConnectionItem, DataAssetItem, DataPickerOptions, DataPickerResult } from './DataPickerContext';

interface DataPickerDialogProps {
  open: boolean;
  teamUuid: string;
  options: DataPickerOptions;
  onSelect: (result: DataPickerResult) => void;
  onCancel: () => void;
}

interface DataListState {
  data: DataAssetItem[];
  dataPrivate: DataAssetItem[];
  isLoading: boolean;
  error: string | null;
}

export function DataPickerDialog({ open, teamUuid, options, onSelect, onCancel }: DataPickerDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'personal' | 'team' | 'connections'>(options.initialTab ?? 'personal');
  const [dataState, setDataState] = useState<DataListState>({
    data: [],
    dataPrivate: [],
    isLoading: true,
    error: null,
  });
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setActiveTab(options.initialTab ?? 'personal');
    }
  }, [open, options.initialTab]);

  // Fetch data when dialog opens
  useEffect(() => {
    if (open && teamUuid) {
      setDataState((prev) => ({ ...prev, isLoading: true, error: null }));

      apiClient.data
        .list(teamUuid)
        .then((response) => {
          setDataState({
            data: response.data,
            dataPrivate: response.dataPrivate,
            isLoading: false,
            error: null,
          });
        })
        .catch((error) => {
          setDataState((prev) => ({
            ...prev,
            isLoading: false,
            error: error.message || 'Failed to load data',
          }));
        });

      // Fetch connections if needed
      if (options.showConnections) {
        setConnectionsLoading(true);
        apiClient.connections
          .list(teamUuid)
          .then((connectionsList) => {
            setConnections(
              connectionsList.map((conn) => ({
                uuid: conn.uuid,
                name: conn.name,
                type: conn.type,
              }))
            );
            setConnectionsLoading(false);
          })
          .catch(() => {
            setConnectionsLoading(false);
          });
      }
    }
  }, [open, teamUuid, options.showConnections]);

  // Filter data by search query and allowed types
  const filterItems = useCallback(
    (items: DataAssetItem[]) => {
      return items.filter((item) => {
        // Filter by allowed types
        if (options.allowedTypes && options.allowedTypes.length > 0) {
          if (!options.allowedTypes.includes(item.type)) {
            return false;
          }
        }
        // Filter by search query
        if (searchQuery) {
          return item.name.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      });
    },
    [searchQuery, options.allowedTypes]
  );

  const filteredPersonalData = useMemo(() => filterItems(dataState.dataPrivate), [dataState.dataPrivate, filterItems]);
  const filteredTeamData = useMemo(() => filterItems(dataState.data), [dataState.data, filterItems]);
  const filteredConnections = useMemo(() => {
    if (!searchQuery) return connections;
    return connections.filter((conn) => conn.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [connections, searchQuery]);

  // Handle file upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !teamUuid) return;

    setIsUploading(true);
    try {
      const file = files[0];
      const response = await apiClient.data.upload({
        teamUuid,
        file,
        isPrivate: activeTab === 'personal',
      });

      // Select the newly uploaded file
      onSelect({
        type: 'uploaded',
        dataAsset: {
          uuid: response.dataAsset.uuid,
          name: response.dataAsset.name,
          type: response.dataAsset.type,
          size: file.size,
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        className="max-w-2xl"
        onDragOver={options.allowUpload ? handleDragOver : undefined}
        onDragLeave={options.allowUpload ? handleDragLeave : undefined}
        onDrop={options.allowUpload ? handleDrop : undefined}
      >
        {/* Drag overlay */}
        {isDragging && options.allowUpload && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-primary/10 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <UploadIcon className="h-12 w-12 text-primary" />
              <p className="font-medium">Drop file to upload</p>
            </div>
          </div>
        )}

        <DialogHeader>
          <DialogTitle>{options.title ?? 'Select Data'}</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search data..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className={cn('grid w-full', options.showConnections ? 'grid-cols-3' : 'grid-cols-2')}>
            <TabsTrigger value="personal" className="gap-2">
              <AccountIcon />
              Personal
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <GroupIcon />
              Team
            </TabsTrigger>
            {options.showConnections && (
              <TabsTrigger value="connections" className="gap-2">
                <DatabaseIcon />
                Connections
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="personal" className="max-h-72 min-h-48 overflow-auto">
            <DataList
              items={filteredPersonalData}
              isLoading={dataState.isLoading}
              emptyMessage="No personal data"
              onSelect={(item) => onSelect({ type: 'data-asset', dataAsset: item })}
            />
          </TabsContent>

          <TabsContent value="team" className="max-h-72 min-h-48 overflow-auto">
            <DataList
              items={filteredTeamData}
              isLoading={dataState.isLoading}
              emptyMessage="No team data"
              onSelect={(item) => onSelect({ type: 'data-asset', dataAsset: item })}
            />
          </TabsContent>

          {options.showConnections && (
            <TabsContent value="connections" className="max-h-72 min-h-48 overflow-auto">
              <ConnectionList
                items={filteredConnections}
                isLoading={connectionsLoading}
                emptyMessage="No connections"
                onSelect={(item) => onSelect({ type: 'connection', connection: item })}
              />
            </TabsContent>
          )}
        </Tabs>

        {/* Upload section */}
        {options.allowUpload && (
          <>
            <Separator />
            <label
              className={cn(
                'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 transition-colors',
                'hover:border-primary hover:bg-accent/50',
                isUploading && 'pointer-events-none opacity-50'
              )}
            >
              <UploadIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isUploading ? 'Uploading...' : 'Drop files here or click to upload'}
              </p>
              <p className="text-xs text-muted-foreground">CSV, Excel, Parquet, PDF, JSON</p>
              <input type="file" className="hidden" onChange={handleInputChange} disabled={isUploading} />
            </label>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Data asset list component
function DataList({
  items,
  isLoading,
  emptyMessage,
  onSelect,
}: {
  items: DataAssetItem[];
  isLoading: boolean;
  emptyMessage: string;
  onSelect: (item: DataAssetItem) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <FileIcon className="mb-2 h-8 w-8" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <button
          key={item.uuid}
          onClick={() => onSelect(item)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
        >
          <DataTypeIcon type={item.type} />
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(item.size)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// Connection list component
function ConnectionList({
  items,
  isLoading,
  emptyMessage,
  onSelect,
}: {
  items: ConnectionItem[];
  isLoading: boolean;
  emptyMessage: string;
  onSelect: (item: ConnectionItem) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <DatabaseIcon className="mb-2 h-8 w-8" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <button
          key={item.uuid}
          onClick={() => onSelect(item)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
        >
          <LanguageIcon language={item.type} />
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.type}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// Icon component for data asset types
function DataTypeIcon({ type }: { type: DataAssetType }) {
  const iconClass = 'h-5 w-5';

  switch (type) {
    case 'EXCEL':
      return <img src="/images/icon-excel.svg" alt="Excel" className={iconClass} />;
    case 'PDF':
      return <img src="/images/icon-pdf.svg" alt="PDF" className={iconClass} />;
    default:
      return <FileIcon className={iconClass} />;
  }
}
