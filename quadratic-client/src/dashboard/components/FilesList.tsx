import { ShareFileDialog } from '@/components/ShareDialog';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { ReactNode, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useFetchers, useLocation } from 'react-router-dom';
import { Empty } from '../../components/Empty';
import useLocalStorage from '../../hooks/useLocalStorage';
import { Loader as FilesLoader } from '../../routes/files';
import { Action as FilesAction } from '../../routes/files.$uuid';
import { FileListItem, FilesListItems } from './FilesListItem';
import { FilesListViewControls } from './FilesListViewControls';
import { Layout, Order, Sort, ViewPreferences } from './FilesListViewControlsDropdown';

export function FilesList({
  isEditable,
  files,
  emptyState,
}: {
  isEditable?: boolean;
  files: FilesLoader;
  emptyState: ReactNode;
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

  // If there are files being duplicated, render them first
  const filesBeingDuplicated = fetchers
    .filter((fetcher) => (fetcher.json as FilesAction['request'])?.action === 'duplicate')
    .map((fetcher) => (fetcher.json as FilesAction['request.duplicate'])?.file);
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
          <FileListItem
            lazyLoad={i > 12}
            key={file.uuid}
            file={file}
            filterValue={filterValue}
            isEditable={isEditable}
            activeShareMenuFileId={activeShareMenuFileId}
            setActiveShareMenuFileId={setActiveShareMenuFileId}
            viewPreferences={viewPreferences}
          />
        ))}
      </FilesListItems>

      {filterValue && filesToRender.length === 0 && (
        <Empty
          title="No matches"
          description={<>No files found with that specified name.</>}
          Icon={MagnifyingGlassIcon}
        />
      )}

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
