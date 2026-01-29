import { fileDragDropModalAtom } from '@/dashboard/atoms/fileDragDropModalAtom';
import { userFilesListFiltersAtom } from '@/dashboard/atoms/userFilesListFiltersAtom';
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
};

export function UserFilesList({
  files,

  teamUuid,
}: {
  files: UserFilesListFile[];
  teamUuid?: string;
}) {
  const { pathname } = useLocation();
  const [filters, setFilters] = useAtom(userFilesListFiltersAtom);
  const filterValue = filters.fileName;
  const fileType = filters.fileType;
  const fetchers = useFetchers();
  const [activeShareMenuFileId, setActiveShareMenuFileId] = useState<string>('');
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

  return (
    <div className="flex flex-grow flex-col" onDragEnter={handleDragEnter}>
      <div className="mb-4 flex flex-row flex-wrap items-center gap-2">
        <FilesListSearchInput
          value={filterValue}
          onChange={(fileName) => setFilters((prev) => ({ ...prev, fileName }))}
        />
        <UserFilesListFileTypeFilter />

        <UserFilesListFiltersDropdown />

        <FilesListViewToggle
          viewPreferences={viewPreferences}
          setViewPreferences={setViewPreferences}
          className="xl:ml-auto"
        />
      </div>

      <FilesListItems viewPreferences={viewPreferences}>
        {filesToRender.map((file, i) => (
          <UserFilesListItem
            key={file.uuid}
            file={file}
            lazyLoad={i > 12}
            setActiveShareMenuFileId={setActiveShareMenuFileId}
            viewPreferences={viewPreferences}
          />
        ))}
      </FilesListItems>

      <UserFilesListEmptyState filesToRenderCount={filesToRender.length} />

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
