import { TYPE } from '@/constants/appConstants';
import { ROUTES } from '@/constants/routes';
import { DOCUMENTATION_URL } from '@/constants/urls';
import { Button } from '@/shadcn/ui/button';
import { cn } from '@/shadcn/utils';
import { ExternalLinkIcon, FileIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import * as Sentry from '@sentry/react';
import mixpanel from 'mixpanel-browser';
import { useState } from 'react';
import { isMobile } from 'react-device-detect';
import { ActionFunctionArgs, Link, useFetchers, useLocation } from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import { Empty } from '../../components/Empty';
import { ShareFileMenu } from '../../components/ShareFileMenu';
import useLocalStorage from '../../hooks/useLocalStorage';
import { FileListItem, FilesListItems } from './FilesListItem';
import { FilesListViewControls } from './FilesListViewControls';
import { Layout, Order, Sort, ViewPreferences } from './FilesListViewControlsDropdown';

export type FilesListFile = Awaited<ReturnType<typeof apiClient.getFiles>>[0];

export type Action = {
  response: { ok: boolean } | null;
  'request.delete': {
    action: 'delete';
  };
  'request.download': {
    action: 'download';
  };
  'request.duplicate': {
    action: 'duplicate';
    file: FilesListFile;
  };
  'request.rename': {
    action: 'rename';
    name: string;
  };
  request:
    | Action['request.delete']
    | Action['request.download']
    | Action['request.duplicate']
    | Action['request.rename'];
};

export function FilesList({ files }: { files: FilesListFile[] }) {
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
    .filter((fetcher) => (fetcher.json as Action['request'])?.action === 'duplicate')
    .map((fetcher) => (fetcher.json as Action['request.duplicate'])?.file);
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
      comparison = a.created_date.localeCompare(b.created_date);
    } else {
      comparison = a.updated_date.localeCompare(b.updated_date);
    }
    return viewPreferences.order === Order.Ascending ? comparison : -comparison;
  });

  const filesBeingDeleted = fetchers.filter((fetcher) => (fetcher.json as Action['request'])?.action === 'delete');
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

      {!filterValue && filesBeingDeleted.length === files.length && filesBeingDuplicated.length === 0 && (
        <Empty
          className="max-w-xl"
          title="No files"
          description={<>You don’t have any files, but you can create one below.</>}
          Icon={FileIcon}
          actions={
            <div>
              {[
                {
                  title: 'Learn the basics',
                  description: 'With an instructional walk-through',
                  link: (
                    <Link
                      to={ROUTES.CREATE_EXAMPLE_FILE('default.grid')}
                      reloadDocument
                      onClick={() => {
                        mixpanel.track('[FilesEmptyState].clickOpenStarterFile');
                      }}
                    >
                      Open starter file
                    </Link>
                  ),
                  className: 'border border-primary bg-yellow-5000',
                },
                {
                  title: 'Get started',
                  description: 'With a fresh new file',
                  link: (
                    <Link
                      to={ROUTES.CREATE_FILE}
                      reloadDocument
                      onClick={() => {
                        mixpanel.track('[FilesEmptyState].clickCreateBlankFile');
                      }}
                    >
                      Create blank file
                    </Link>
                  ),
                  className: 'border-b border-border',
                },
                {
                  title: 'See what’s possible',
                  description: 'Like filtering and fetching data',
                  link: (
                    <Link
                      to={ROUTES.EXAMPLES}
                      onClick={() => {
                        mixpanel.track('[FilesEmptyState].clickExploreExamples');
                      }}
                    >
                      Explore examples
                    </Link>
                  ),
                  className: 'border-b border-border',
                },
                {
                  title: 'Deep dive',
                  description: 'All the details of using the app',
                  link: (
                    <Link
                      to={DOCUMENTATION_URL}
                      target="_blank"
                      onClick={() => {
                        mixpanel.track('[FilesEmptyState].clickReadDocs');
                      }}
                    >
                      Read the docs
                      <ExternalLinkIcon className="ml-2" />
                    </Link>
                  ),
                },
              ].map(({ title, description, link, className }, i) => (
                <div
                  key={i}
                  className={cn(`p-3 text-center sm:flex sm:items-center sm:justify-between sm:text-left`, className)}
                >
                  <div className="mb-2 flex flex-col sm:mb-0">
                    <h2 className={`${TYPE.body2} font-semibold`}>{title}</h2>
                    <p className={`${TYPE.body2} text-muted-foreground`}>{description}</p>
                  </div>

                  <Button asChild variant="secondary">
                    {link}
                  </Button>
                </div>
              ))}
            </div>
          }
        />
      )}

      {activeShareMenuFileId && (
        <ShareFileMenu
          onClose={() => {
            setActiveShareMenuFileId('');
          }}
          permission={'OWNER'}
          uuid={activeShareMenuFileId}
          fileName={activeShareMenuFileName}
        />
      )}
    </>
  );
}

export const action = async ({ params, request }: ActionFunctionArgs): Promise<Action['response']> => {
  const json: Action['request'] = await request.json();
  const { uuid } = params as { uuid: string };
  const { action } = json;

  if (action === 'delete') {
    try {
      await apiClient.deleteFile(uuid);
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  if (action === 'download') {
    try {
      await apiClient.downloadFile(uuid);
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  if (action === 'duplicate') {
    try {
      const {
        file: { name },
      } = json as Action['request.duplicate'];

      // Get the file we want to duplicate
      const {
        file: { contents, version, thumbnail },
      } = await apiClient.getFile(uuid);

      // Create it on the server
      const newFile = await apiClient.createFile({ name, version, contents });

      // If present, fetch the thumbnail of the file we just dup'd and
      // save it to the new file we just created
      if (thumbnail) {
        try {
          const res = await fetch(thumbnail);
          const blob = await res.blob();
          await apiClient.updateFileThumbnail(newFile.uuid, blob);
        } catch (err) {
          // Not a huge deal if it failed, just tell Sentry and move on
          Sentry.captureEvent({
            message: 'Failed to duplicate the thumbnail image when duplicating a file',
            level: 'info',
          });
        }
      }
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  if (action === 'rename') {
    try {
      const { name } = json as Action['request.rename'];
      await apiClient.updateFile(uuid, { name });
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  return null;
};
