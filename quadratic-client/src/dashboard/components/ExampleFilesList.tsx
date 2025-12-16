import { FilesListControlsRow } from '@/dashboard/components/FilesListControlsRow';
import { FilesListEmptyFilterState } from '@/dashboard/components/FilesListEmptyFilterState';
import { FilesListItemCore } from '@/dashboard/components/FilesListItemCore';
import { FilesListItems, ListItem, ListItemView } from '@/dashboard/components/FilesListItems';
import { FilesListSearchInput } from '@/dashboard/components/FilesListSearchInput';
import {
  FilesListViewToggle,
  Layout,
  type ViewPreferences,
} from '@/dashboard/components/FilesListViewControlsDropdown';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { isMobile } from 'react-device-detect';
import { Link, useLocation } from 'react-router';

export type ExampleFilesListFile = {
  description: string;
  href: string;
  name: string;
  thumbnail: string;
};

export function ExampleFilesList({ files, emptyState }: { files: ExampleFilesListFile[]; emptyState?: ReactNode }) {
  const { pathname } = useLocation();
  const [searchValue, setSearchValue] = useState('');
  const [viewPreferences, setViewPreferences] = useLocalStorage<ViewPreferences>(
    // Persist the layout preference across views (by URL)
    `FilesList-${pathname}`,
    // Initial state
    {
      layout: isMobile ? Layout.List : Layout.Grid,
    }
  );

  const filesToRender = searchValue
    ? files.filter(({ name }) => name.toLowerCase().includes(searchValue.toLowerCase()))
    : files;

  return (
    <>
      <FilesListControlsRow>
        <FilesListSearchInput value={searchValue} onChange={setSearchValue} />
        <FilesListViewToggle
          viewPreferences={viewPreferences}
          setViewPreferences={setViewPreferences}
          className="ml-auto"
        />
      </FilesListControlsRow>

      <FilesListItems viewPreferences={viewPreferences}>
        {filesToRender.map((file, i) => {
          const { href, name, thumbnail, description } = file;
          const lazyLoad = i > 12;

          return (
            <ListItem>
              <Link to={href} className="flex w-full" reloadDocument>
                <ListItemView viewPreferences={viewPreferences} thumbnail={thumbnail} lazyLoad={lazyLoad}>
                  <FilesListItemCore
                    name={name}
                    nameFilter={searchValue}
                    description={description}
                    viewPreferences={viewPreferences}
                  />
                </ListItemView>
              </Link>
            </ListItem>
          );
        })}
      </FilesListItems>

      {searchValue && filesToRender.length === 0 && <FilesListEmptyFilterState />}
    </>
  );
}
