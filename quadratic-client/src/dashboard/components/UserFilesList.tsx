import { dashboardSelectedFileUuidsAtom } from '@/dashboard/atoms/dashboardSelectedFileUuidsAtom';
import { fileDragDropModalAtom } from '@/dashboard/atoms/fileDragDropModalAtom';
import { userFilesListFiltersAtom } from '@/dashboard/atoms/userFilesListFiltersAtom';
import { BulkFileActionsBar } from '@/dashboard/components/BulkFileActionsBar';
import { FileDragDrop } from '@/dashboard/components/FileDragDrop';
import { FilesListItems } from '@/dashboard/components/FilesListItems';
import { FilesListSearchInput } from '@/dashboard/components/FilesListSearchInput';
import {
  FilesListViewToggle,
  Layout,
  Order,
  Sort,
  type ViewPreferences,
} from '@/dashboard/components/FilesListViewControlsDropdown';
import { UserFilesListEmptyState } from '@/dashboard/components/UserFilesListEmptyState';
import { UserFilesListFileTypeFilter } from '@/dashboard/components/UserFilesListFileTypeFilter';
import { UserFilesListItem } from '@/dashboard/components/UserFilesListItem';
import { UserFilesListFiltersDropdown } from '@/dashboard/components/UserFilesListOtherFiltersDropdown';
import type { Action as FilesAction } from '@/routes/api.files.$uuid';
import { ShareFileDialog } from '@/shared/components/ShareDialog';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { useUpdateQueryStringValueWithoutNavigation } from '@/shared/hooks/useUpdateQueryStringValueWithoutNavigation';
import { useAtom } from 'jotai';
import type { FilePermission, PublicLinkAccess } from 'quadratic-shared/typesAndSchemas';
import { useCallback, useEffect, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useFetchers, useLocation } from 'react-router';
import { useSetRecoilState } from 'recoil';

export type FileCreator = {
  name?: string;
  picture?: string;
  email?: string;
};

export type UserFilesListFile = {
  createdDate: string;
  name: string;
  publicLinkAccess: PublicLinkAccess;
  permissions: FilePermission[];
  thumbnail: string | null;
  hasScheduledTasks: boolean;
  updatedDate: string;
  uuid: string;
  creator?: FileCreator;
  fileType: 'team' | 'private' | 'shared';
  /** Whether this file has edit restrictions due to soft file limit (free teams only). */
  requiresUpgradeToEdit?: boolean;
  /** Folder path for the title line (e.g. "Subfolder" or "Parent/Subfolder"), one level deeper than root. */
  folderPath?: string;
};

export function UserFilesList({
  files,
  teamUuid,
  hideTypeFilters,
}: {
  files: UserFilesListFile[];
  teamUuid?: string;
  hideTypeFilters?: boolean;
}) {
  const { pathname } = useLocation();
  const [filters, setFilters] = useAtom(userFilesListFiltersAtom);
  const [selectedFileUuids, setSelectedFileUuids] = useAtom(dashboardSelectedFileUuidsAtom);
  const filterValue = filters.fileName;
  const fileType = filters.fileType;
  const fetchers = useFetchers();
  const [activeShareMenuFileId, setActiveShareMenuFileId] = useState<string>('');

  const [selectionAnchorUuid, setSelectionAnchorUuid] = useState<string | null>(null);
  const isSelectionMode = selectedFileUuids.size > 0;
  const onToggleSelection = useCallback(
    (uuid: string) => {
      setSelectedFileUuids((prev: Set<string>) => {
        const next = new Set(prev);
        if (next.has(uuid)) next.delete(uuid);
        else next.add(uuid);
        return next;
      });
      setSelectionAnchorUuid(uuid);
    },
    [setSelectedFileUuids]
  );
  const clearSelection = useCallback(() => {
    setSelectedFileUuids(new Set());
    setSelectionAnchorUuid(null);
  }, [setSelectedFileUuids]);
  const onSelectOnly = useCallback(
    (uuid: string) => {
      setSelectedFileUuids(new Set([uuid]));
      setSelectionAnchorUuid(uuid);
    },
    [setSelectedFileUuids]
  );

  // Clear selection when navigating away
  useEffect(() => {
    clearSelection();
  }, [pathname, clearSelection]);

  // Clear selection on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection]);
  const [viewPreferences, setViewPreferences] = useLocalStorage<ViewPreferences>(
    // Persist the layout preference across views (by URL)
    `FilesList-${pathname}`,
    // Initial state
    {
      sort: Sort.Updated,
      order: Order.Descending,
      layout: isMobile ? Layout.List : Layout.Grid,
    }
  );

  // We handle the file type in the URL without using the router
  useUpdateQueryStringValueWithoutNavigation('type', fileType);

  // When we navigate away from the page, reset the file type
  useEffect(() => {
    return () => {
      setFilters((prev) => ({
        ...prev,
        fileType: null,
      }));
    };
  }, [setFilters]);

  // We will optimistcally render the list of files
  let filesToRender = files;

  // If there are files being duplicated, prepend them to the list
  const filesBeingDuplicated = fetchers
    .filter((fetcher) => (fetcher.json as FilesAction['request'])?.action === 'duplicate')
    .map((fetcher, i) => {
      // Grab the file UUID from the `formAction` whose pattern is: "/files/:uuid"
      // (filter makes sure there's no trailing slash to deal with)
      const fileUuid = fetcher.formAction?.split('/').filter(Boolean).pop();
      // We should never have a file that's duplicating that's not in the list
      // Because we're always working off the files we have in memory.
      // This file _could_ be deleted from the server, but the action will fail
      // if that's the case (and this file will disappear from the UI upon revalidation)
      const file = files.find((file) => file.uuid === fileUuid) as UserFilesListFile;
      return {
        ...file,
        uuid: `${fileUuid}--duplicate-${i}`,
        name: file.name + ` (Copy)`,
        updatedDate: new Date().toISOString(),
      };
    });
  if (filesBeingDuplicated.length > 0) {
    filesToRender = [...filesBeingDuplicated, ...filesToRender];
  }

  // If the user has an active filter query, remove those
  if (filterValue) {
    filesToRender = filesToRender.filter((file) => {
      const { name } = file;
      const fileNameNormalized = name.toLowerCase();

      const filterValueNormalized = filterValue.toLowerCase();

      return fileNameNormalized.includes(filterValueNormalized);
    });
  }

  // Filter by file type
  if (fileType === 'private') {
    filesToRender = filesToRender.filter((file) => file.fileType === 'private');
  } else if (fileType === 'team') {
    filesToRender = filesToRender.filter((file) => file.fileType === 'team');
  } else if (fileType === 'shared') {
    filesToRender = filesToRender.filter((file) => file.fileType === 'shared');
  }

  // Filter by publicly shared
  if (filters.sharedPublicly) {
    filesToRender = filesToRender.filter((file) => file.publicLinkAccess !== 'NOT_SHARED');
  }

  // Filter by scheduled tasks
  if (filters.hasScheduledTasks) {
    filesToRender = filesToRender.filter((file) => file.hasScheduledTasks);
  }

  // Filter by file creator
  if (filters.fileCreatorEmails.length > 0) {
    filesToRender = filesToRender.filter(
      (file) => file.creator && file.creator.email && filters.fileCreatorEmails.includes(file.creator.email)
    );
  }

  // Sort 'em based on current prefs
  filesToRender.sort((a, b) => {
    let comparison;
    if (viewPreferences.sort === Sort.Alphabetical) {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      comparison = nameA.localeCompare(nameB);
    } else if (viewPreferences.sort === Sort.Created) {
      comparison = a.createdDate.localeCompare(b.createdDate);
    } else {
      comparison = a.updatedDate.localeCompare(b.updatedDate);
    }
    return viewPreferences.order === Order.Ascending ? comparison : -comparison;
  });

  const activeShareMenuFileName = files.find((file) => file.uuid === activeShareMenuFileId)?.name || '';

  const setFileDragDropState = useSetRecoilState(fileDragDropModalAtom);
  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (teamUuid === undefined || !e.dataTransfer.types.includes('Files')) return;
      setFileDragDropState({ show: true, teamUuid, isPrivate: true });
    },
    [setFileDragDropState, teamUuid]
  );

  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (selectedFileUuids.size === 0) return;
      const target = e.target as HTMLElement;
      // Only clear selection when clicking the list background (empty space in the file list),
      // not when clicking toolbar, bulk actions bar, buttons, menus, etc.
      const isListBackground = target.closest?.('[data-file-list-background]') && !target.closest?.('[data-file-item]');
      if (!isListBackground) return;
      clearSelection();
    },
    [selectedFileUuids.size, clearSelection]
  );

  const onShiftClickSelection = useCallback(
    (uuid: string) => {
      if (!selectionAnchorUuid) {
        setSelectedFileUuids(new Set([uuid]));
        setSelectionAnchorUuid(uuid);
        return;
      }
      const anchorIdx = filesToRender.findIndex((f) => f.uuid === selectionAnchorUuid);
      const clickIdx = filesToRender.findIndex((f) => f.uuid === uuid);
      if (anchorIdx === -1 || clickIdx === -1) {
        setSelectedFileUuids(new Set([uuid]));
        setSelectionAnchorUuid(uuid);
        return;
      }
      const start = Math.min(anchorIdx, clickIdx);
      const end = Math.max(anchorIdx, clickIdx);
      const rangeUuids = filesToRender.slice(start, end + 1).map((f) => f.uuid);
      setSelectedFileUuids(new Set(rangeUuids));
    },
    [filesToRender, selectionAnchorUuid, setSelectedFileUuids]
  );

  return (
    <div className="flex flex-grow flex-col" onDragEnter={handleDragEnter} onClick={handleContainerClick}>
      <div className="mb-4 flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex flex-row flex-wrap items-center gap-2">
          <FilesListSearchInput
            value={filterValue}
            onChange={(fileName) => setFilters((prev) => ({ ...prev, fileName }))}
          />
          {!hideTypeFilters && <UserFilesListFileTypeFilter />}
          {!hideTypeFilters && <UserFilesListFiltersDropdown />}
        </div>
        <FilesListViewToggle viewPreferences={viewPreferences} setViewPreferences={setViewPreferences} />
      </div>

      {selectedFileUuids.size > 1 && (
        <BulkFileActionsBar
          selectedFiles={filesToRender.filter((f) => selectedFileUuids.has(f.uuid))}
          onClearSelection={clearSelection}
        />
      )}

      <div className="min-h-0 flex-1" data-file-list-background>
        <FilesListItems viewPreferences={viewPreferences}>
          {filesToRender.map((file, i) => (
            <UserFilesListItem
              key={file.uuid}
              file={file}
              lazyLoad={i > 12}
              setActiveShareMenuFileId={setActiveShareMenuFileId}
              viewPreferences={viewPreferences}
              selectedFileUuids={selectedFileUuids}
              onToggleSelection={onToggleSelection}
              onSelectOnly={onSelectOnly}
              onShiftClickSelection={onShiftClickSelection}
              isSelectionMode={isSelectionMode}
            />
          ))}
        </FilesListItems>

        <UserFilesListEmptyState filesToRenderCount={filesToRender.length} />
      </div>

      {activeShareMenuFileId && (
        <ShareFileDialog
          onClose={() => {
            setActiveShareMenuFileId('');
          }}
          uuid={activeShareMenuFileId}
          name={activeShareMenuFileName}
        />
      )}

      {/* DRAWER_WIDTH is hard-coded here so we can use the tailwind responsive class
          you'll have to update this if you change it */}
      <FileDragDrop className={`lg:left-[264px] lg:w-[calc(100%-264px)]`} />
    </div>
  );
}
