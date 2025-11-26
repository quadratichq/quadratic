import { fileDragDropModalAtom } from '@/dashboard/atoms/fileDragDropModalAtom';
import { FileDragDrop } from '@/dashboard/components/FileDragDrop';
import { FilesListItemExampleFile, FilesListItems, FilesListItemUserFile } from '@/dashboard/components/FilesListItem';
import { FilesListViewControls } from '@/dashboard/components/FilesListViewControls';
import { Layout, Order, Sort, type ViewPreferences } from '@/dashboard/components/FilesListViewControlsDropdown';
import { DRAWER_WIDTH } from '@/routes/_dashboard';
import type { Action as FilesAction } from '@/routes/api.files.$uuid';
import { EmptyState } from '@/shared/components/EmptyState';
import { ShareFileDialog } from '@/shared/components/ShareDialog';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import type { FilePermission, PublicLinkAccess } from 'quadratic-shared/typesAndSchemas';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useFetchers, useLocation } from 'react-router';
import { useSetRecoilState } from 'recoil';

export type FilesListUserFile = {
  createdDate: string;
  name: string;
  publicLinkAccess: PublicLinkAccess;
  permissions: FilePermission[];
  thumbnail: string | null;
  updatedDate: string;
  uuid: string;
  creator?: {
    name?: string;
    picture?: string;
    email?: string;
  };
  filterMatch?: 'file-name' | 'creator-name' | 'creator-email';
  /** Whether this is a private file (true) or team file (false). Used to show a tag on the file card. */
  isPrivate?: boolean;
};

export function FilesList({
  files,
  emptyState,
  teamUuid,
  isPrivate,
}: {
  files: FilesListUserFile[];
  emptyState?: ReactNode;
  teamUuid?: string;
  isPrivate?: boolean;
}) {
  const { pathname } = useLocation();
  const [filterValue, setFilterValue] = useState<string>('');
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
      const file = files.find((file) => file.uuid === fileUuid) as FilesListUserFile;
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
    filesToRender = filesToRender
      .map((file) => {
        const { name, creator } = file;
        const fileNameNormalized = name.toLowerCase();
        const creatorNameNormalized = creator?.name?.toLowerCase() || '';
        const creatorEmailNormalized = creator?.email?.toLowerCase() || '';
        const filterValueNormalized = filterValue.toLowerCase();

        let filterMatch: FilesListUserFile['filterMatch'] = undefined;
        if (fileNameNormalized.includes(filterValueNormalized)) {
          filterMatch = 'file-name';
        } else if (creatorNameNormalized.includes(filterValueNormalized)) {
          filterMatch = 'creator-name';
        } else if (creatorEmailNormalized.includes(filterValueNormalized)) {
          filterMatch = 'creator-email';
        }

        return filterMatch
          ? {
              ...file,
              filterMatch,
            }
          : file;
      })
      .filter((item) => item.filterMatch);
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

  const filesBeingDeleted = fetchers.filter((fetcher) => (fetcher.json as FilesAction['request'])?.action === 'delete');
  const activeShareMenuFileName = files.find((file) => file.uuid === activeShareMenuFileId)?.name || '';

  const setFileDragDropState = useSetRecoilState(fileDragDropModalAtom);
  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (teamUuid === undefined || isPrivate === undefined || !e.dataTransfer.types.includes('Files')) return;
      setFileDragDropState({ show: true, teamUuid, isPrivate });
    },
    [isPrivate, setFileDragDropState, teamUuid]
  );

  return (
    <div className="flex flex-grow flex-col" onDragEnter={handleDragEnter}>
      <FilesListViewControls
        filterValue={filterValue}
        setFilterValue={setFilterValue}
        viewPreferences={viewPreferences}
        setViewPreferences={setViewPreferences}
      />

      <FilesListItems viewPreferences={viewPreferences}>
        {filesToRender.map((file, i) => (
          <FilesListItemUserFile
            key={file.uuid}
            file={file}
            lazyLoad={i > 12}
            filterValue={filterValue}
            setFilterValue={setFilterValue}
            setActiveShareMenuFileId={setActiveShareMenuFileId}
            viewPreferences={viewPreferences}
          />
        ))}
      </FilesListItems>

      {filterValue && filesToRender.length === 0 && <EmptyFilterState />}

      {!filterValue && filesBeingDeleted.length === files.length && filesBeingDuplicated.length === 0 && emptyState}

      {activeShareMenuFileId && (
        <ShareFileDialog
          onClose={() => {
            setActiveShareMenuFileId('');
          }}
          uuid={activeShareMenuFileId}
          name={activeShareMenuFileName}
        />
      )}

      <FileDragDrop className={`lg:left-[${DRAWER_WIDTH}px] lg:w-[calc(100%-${DRAWER_WIDTH}px)]`} />
    </div>
  );
}

export type FilesListTemplateFile = {
  description: string;
  href: string;
  name: string;
  thumbnail: string;
};

export function ExampleFilesList({ files, emptyState }: { files: FilesListTemplateFile[]; emptyState?: ReactNode }) {
  const { pathname } = useLocation();
  const [filterValue, setFilterValue] = useState<string>('');
  const [viewPreferences, setViewPreferences] = useLocalStorage<ViewPreferences>(
    // Persist the layout preference across views (by URL)
    `FilesList-${pathname}`,
    // Initial state
    {
      layout: isMobile ? Layout.List : Layout.Grid,
    }
  );

  const filesToRender = filterValue
    ? files.filter(({ name }) => name.toLowerCase().includes(filterValue.toLowerCase()))
    : files;

  return (
    <>
      <FilesListViewControls
        filterValue={filterValue}
        setFilterValue={setFilterValue}
        viewPreferences={viewPreferences}
        setViewPreferences={setViewPreferences}
      />

      <FilesListItems viewPreferences={viewPreferences}>
        {filesToRender.map((file, i) => {
          const { href, name, thumbnail, description } = file;
          const lazyLoad = i > 12;

          return (
            <FilesListItemExampleFile
              key={href}
              file={{
                name,
                href,
                thumbnail,
                description,
              }}
              filterValue={filterValue}
              lazyLoad={lazyLoad}
              viewPreferences={viewPreferences}
            />
          );
        })}
      </FilesListItems>

      {filterValue && filesToRender.length === 0 && <EmptyFilterState />}
    </>
  );
}

function EmptyFilterState() {
  return (
    <div className="flex min-h-80 items-center justify-center">
      <EmptyState
        title="No matches"
        description={'No files found with that specified name.'}
        Icon={MagnifyingGlassIcon}
      />
    </div>
  );
}
