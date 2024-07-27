import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import type { FilePermission, PublicLinkAccess } from 'quadratic-shared/typesAndSchemas';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { isMobile } from 'react-device-detect';
import { useFetchers, useLocation } from 'react-router-dom';

import { Empty } from '@/dashboard/components/Empty';
import { FilesListItemExampleFile, FilesListItems, FilesListItemUserFile } from '@/dashboard/components/FilesListItem';
import { FilesListViewControls } from '@/dashboard/components/FilesListViewControls';
import type { ViewPreferences } from '@/dashboard/components/FilesListViewControlsDropdown';
import { Layout, Order, Sort } from '@/dashboard/components/FilesListViewControlsDropdown';
import type { Action as FilesAction } from '@/routes/api.files.$uuid';
import { ShareFileDialog } from '@/shared/components/ShareDialog';
import useLocalStorage from '@/shared/hooks/useLocalStorage';

export type FilesListUserFile = {
  createdDate: string;
  name: string;
  publicLinkAccess: PublicLinkAccess;
  permissions: FilePermission[];
  thumbnail: string | null;
  updatedDate: string;
  uuid: string;
};

export function FilesList({ files, emptyState }: { files: FilesListUserFile[]; emptyState?: ReactNode }) {
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
    filesToRender = filesToRender.filter(({ name }) => name.toLowerCase().includes(filterValue.toLowerCase()));
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

  return (
    <>
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
            activeShareMenuFileId={activeShareMenuFileId}
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
    </>
  );
}

export type FilesListExampleFile = {
  description: string;
  href: string;
  name: string;
  thumbnail: string;
};

export function ExampleFilesList({ files }: { files: FilesListExampleFile[]; emptyState?: ReactNode }) {
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
    <Empty title="No matches" description={<>No files found with that specified name.</>} Icon={MagnifyingGlassIcon} />
  );
}
