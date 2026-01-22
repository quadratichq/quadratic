import { aiChatFilesDirect } from '@/app/ai/aiChatFilesDirect';
import { useFileImport } from '@/app/ui/hooks/useFileImport';
import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { apiClient } from '@/shared/api/apiClient';
import {
  AccountIcon,
  AIIcon,
  DeleteIcon,
  DownloadIcon,
  FileIcon,
  FileOpenIcon,
  GroupIcon,
  MoreHorizIcon,
  SearchIcon,
  UploadIcon,
} from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Input } from '@/shared/shadcn/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { cn } from '@/shared/shadcn/utils';
import { formatBytes } from '@/shared/utils/formatBytes';
import type { DataAssetType } from 'quadratic-shared/typesAndSchemas';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Navigate, useLoaderData, useNavigate, useRevalidator } from 'react-router';

interface DataAssetItem {
  uuid: string;
  name: string;
  type: DataAssetType;
  size: number;
  createdDate: string;
  updatedDate: string;
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { teamUuid } = params;
  if (!teamUuid) throw new Error('No team UUID provided');

  const dataResponse = await apiClient.data.list(teamUuid);
  return { teamUuid, ...dataResponse };
};

// File types that can be opened in a spreadsheet
const SPREADSHEET_TYPES: DataAssetType[] = ['CSV', 'EXCEL', 'PARQUET'];

export const Component = () => {
  const { teamUuid, data: teamData, dataPrivate: personalData } = useLoaderData<typeof loader>();
  const {
    activeTeam: {
      userMakingRequest: { teamPermissions },
    },
  } = useDashboardRouteLoaderData();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const handleFileImport = useFileImport();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'personal' | 'team'>('personal');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter data by search query
  const filterItems = useCallback(
    (items: DataAssetItem[]) => {
      if (!searchQuery) return items;
      return items.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    },
    [searchQuery]
  );

  const filteredPersonalData = useMemo(() => filterItems(personalData), [personalData, filterItems]);
  const filteredTeamData = useMemo(() => filterItems(teamData), [teamData, filterItems]);

  // Check permissions - must be after all hooks
  if (!teamPermissions?.includes('TEAM_EDIT')) {
    return <Navigate to={ROUTES.TEAM(teamUuid)} />;
  }

  // Handle file upload
  const handleUpload = async (files: FileList | null, isPrivate: boolean) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        await apiClient.data.upload({
          teamUuid,
          file,
          isPrivate,
        });
      }
      // Refresh data
      revalidator.revalidate();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (dataUuid: string) => {
    try {
      await apiClient.data.delete({ teamUuid, dataUuid });
      revalidator.revalidate();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleDownload = async (dataUuid: string, name: string) => {
    try {
      const { downloadUrl } = await apiClient.data.getDownloadUrl({ teamUuid, dataUuid });
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = name;
      link.click();
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  // Download file and convert to File object
  const downloadFileAsBlob = async (dataUuid: string, name: string, mimeType: string): Promise<File | null> => {
    try {
      const { downloadUrl } = await apiClient.data.getDownloadUrl({ teamUuid, dataUuid });
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      return new File([blob], name, { type: mimeType || blob.type });
    } catch (error) {
      console.error('Failed to download file:', error);
      return null;
    }
  };

  // Handle "Start with AI" - download file and navigate to AI create flow
  const handleStartWithAI = async (item: DataAssetItem) => {
    const mimeTypeMap: Record<DataAssetType, string> = {
      CSV: 'text/csv',
      EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      PARQUET: 'application/vnd.apache.parquet',
      PDF: 'application/pdf',
      JSON: 'application/json',
      OTHER: 'application/octet-stream',
    };

    const file = await downloadFileAsBlob(item.uuid, item.name, mimeTypeMap[item.type]);
    if (!file) return;

    // Save file to IndexedDB for the AI flow to pick up
    const chatId = crypto.randomUUID();
    const arrayBuffer = await file.arrayBuffer();
    await aiChatFilesDirect.saveFiles(chatId, [
      {
        name: file.name,
        type: file.type,
        size: file.size,
        data: arrayBuffer,
      },
    ]);

    // Navigate to Start with AI with the file attached
    navigate(ROUTES.CREATE_FILE(teamUuid, { private: true, chatId }));
  };

  // Handle "Open in Spreadsheet" - download file and create new file with it
  const handleOpenInSpreadsheet = async (item: DataAssetItem) => {
    const mimeTypeMap: Record<DataAssetType, string> = {
      CSV: 'text/csv',
      EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      PARQUET: 'application/vnd.apache.parquet',
      PDF: 'application/pdf',
      JSON: 'application/json',
      OTHER: 'application/octet-stream',
    };

    const file = await downloadFileAsBlob(item.uuid, item.name, mimeTypeMap[item.type]);
    if (!file) return;

    // Use the file import hook to create a new file
    handleFileImport({ files: [file], isPrivate: true, teamUuid });
  };

  return (
    <>
      <DashboardHeader
        title="Data"
        actions={
          <>
            <Button disabled={isUploading} className="gap-2" onClick={() => fileInputRef.current?.click()}>
              <UploadIcon />
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => {
                handleUpload(e.target.files, activeTab === 'personal');
                // Reset input so same file can be uploaded again
                e.target.value = '';
              }}
              disabled={isUploading}
            />
          </>
        }
      />

      <div className="max-w-4xl space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
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
          <TabsList>
            <TabsTrigger value="personal" className="gap-2">
              <AccountIcon />
              Personal ({personalData.length})
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <GroupIcon />
              Team ({teamData.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="mt-4">
            <DataList
              items={filteredPersonalData}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onStartWithAI={handleStartWithAI}
              onOpenInSpreadsheet={handleOpenInSpreadsheet}
            />
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            <DataList
              items={filteredTeamData}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onStartWithAI={handleStartWithAI}
              onOpenInSpreadsheet={handleOpenInSpreadsheet}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

function DataList({
  items,
  onDelete,
  onDownload,
  onStartWithAI,
  onOpenInSpreadsheet,
}: {
  items: DataAssetItem[];
  onDelete: (uuid: string) => void;
  onDownload: (uuid: string, name: string) => void;
  onStartWithAI: (item: DataAssetItem) => void;
  onOpenInSpreadsheet: (item: DataAssetItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-12 text-muted-foreground">
        <FileIcon className="mb-2 h-12 w-12" />
        <p className="text-lg font-medium">No data yet</p>
        <p className="text-sm">Upload files to get started</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-sm text-muted-foreground">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Size</th>
            <th className="px-4 py-3 font-medium">Updated</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const canOpenInSpreadsheet = SPREADSHEET_TYPES.includes(item.type);
            return (
              <tr key={item.uuid} className="group border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <DataTypeIcon type={item.type} />
                    <span className="font-medium">{item.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{item.type}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{formatBytes(item.size)}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(item.updatedDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {/* Action buttons - visible on hover */}
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onStartWithAI(item)}>
                        <AIIcon />
                        Chat with File
                      </Button>
                      {canOpenInSpreadsheet && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => onOpenInSpreadsheet(item)}
                        >
                          <FileOpenIcon />
                          Open in Spreadsheet
                        </Button>
                      )}
                    </div>
                    {/* More menu for secondary actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onStartWithAI(item)} className="gap-2">
                          <AIIcon />
                          Chat with File
                        </DropdownMenuItem>
                        {canOpenInSpreadsheet && (
                          <DropdownMenuItem onClick={() => onOpenInSpreadsheet(item)} className="gap-2">
                            <FileOpenIcon />
                            Open in spreadsheet
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onDownload(item.uuid, item.name)} className="gap-2">
                          <DownloadIcon />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(item.uuid)} className="gap-2 text-destructive">
                          <DeleteIcon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DataTypeIcon({ type }: { type: DataAssetType }) {
  const iconClass = 'h-5 w-5';

  switch (type) {
    case 'EXCEL':
      return <img src="/images/icon-excel.svg" alt="Excel" className={iconClass} />;
    case 'PDF':
      return <img src="/images/icon-pdf.svg" alt="PDF" className={iconClass} />;
    default:
      return <FileIcon className={cn(iconClass, 'text-muted-foreground')} />;
  }
}
