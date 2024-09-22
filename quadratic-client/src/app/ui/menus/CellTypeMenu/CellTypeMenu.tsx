import { cellTypeMenuOpenedCountAtom } from '@/app/atoms/cellTypeMenuOpenedCountAtom';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { LinkNewTab } from '@/app/ui/components/LinkNewTab';
import { JavaScript } from '@/app/ui/icons';
import {
  DOCUMENTATION_FORMULAS_URL,
  DOCUMENTATION_JAVASCRIPT_URL,
  DOCUMENTATION_PYTHON_URL,
  DOCUMENTATION_URL,
} from '@/shared/constants/urls';
import mixpanel from 'mixpanel-browser';
import React, { useCallback, useEffect } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import '../../styles/floating-dialog.css';

import { colors } from '@/app/theme/colors';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { DatabaseIcon } from '@/shared/components/Icons';
import { Badge } from '@/shared/shadcn/ui/badge';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/shared/shadcn/ui/command';

export interface CellTypeOption {
  name: string;
  searchStrings?: string[];
  mode: CodeCellLanguage;
  icon: any;
  description: string | JSX.Element;
  disabled?: boolean;
  experimental?: boolean;
}

let CELL_TYPE_OPTIONS: CellTypeOption[] = [
  {
    name: 'Python',
    mode: 'Python',
    icon: <LanguageIcon language="Python" />,
    description: (
      <>
        Script with Pandas, NumPy, SciPy, Micropip,{' '}
        <LinkNewTabWrapper href={DOCUMENTATION_PYTHON_URL}>and more</LinkNewTabWrapper>.
      </>
    ),
  },
  {
    name: 'Formula',
    searchStrings: ['fx', 'functions', 'formulas'],
    mode: 'Formula',
    icon: <LanguageIcon language="Formula" />,
    description: (
      <>
        Classic spreadsheet logic like <code>SUM</code>, <code>AVERAGE</code>,{' '}
        <LinkNewTabWrapper href={DOCUMENTATION_FORMULAS_URL}>and more</LinkNewTabWrapper>.
      </>
    ),
  },
  {
    name: 'JavaScript',
    searchStrings: ['js'],
    mode: 'Javascript',
    icon: <JavaScript sx={{ color: colors.languageJavascript }} />,
    description: (
      <>
        Script with modern ES modules{' '}
        <LinkNewTabWrapper href={DOCUMENTATION_JAVASCRIPT_URL}>and more</LinkNewTabWrapper>.
      </>
    ),
    experimental: true,
  },
];

export default function CellTypeMenu() {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const setCellTypeMenuOpenedCount = useSetRecoilState(cellTypeMenuOpenedCountAtom);
  const fetcher = useConnectionsFetcher();

  const searchLabel = 'Choose a cell type…';

  useEffect(() => {
    mixpanel.track('[CellTypeMenu].opened');
    setCellTypeMenuOpenedCount((count: number) => count + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback(() => {
    setEditorInteractionState({
      ...editorInteractionState,
      showCellTypeMenu: false,
    });
  }, [editorInteractionState, setEditorInteractionState]);

  const openEditor = useCallback(
    (mode: CodeCellLanguage) => {
      mixpanel.track('[CellTypeMenu].selected', { mode });
      setEditorInteractionState({
        ...editorInteractionState,
        showCodeEditor: true,
        showCellTypeMenu: false,
        mode,
      });
    },
    [editorInteractionState, setEditorInteractionState]
  );

  return (
    <CommandDialog
      dialogProps={{ open: true, onOpenChange: close }}
      commandProps={{}}
      overlayProps={{
        onPointerDown: (e) => {
          e.preventDefault();
          e.stopPropagation();
          close();
        },
      }}
    >
      <CommandInput placeholder={searchLabel} id="CellTypeMenuInputID" />
      <CommandList id="CellTypeMenuID">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Languages">
          {CELL_TYPE_OPTIONS.map(({ name, disabled, experimental, icon, description, mode }, i) => (
            <CommandItemWrapper
              key={name}
              disabled={disabled}
              icon={icon}
              name={name}
              experimental={experimental}
              description={description}
              onSelect={() => openEditor(mode)}
            />
          ))}
        </CommandGroup>

        <CommandSeparator />
        {fetcher.data?.connections && (
          <CommandGroup heading="Connections">
            {fetcher.data.connections.map(({ name, type, uuid }) => (
              <CommandItemWrapper
                key={uuid}
                uuid={uuid}
                name={name}
                description={`${type === 'POSTGRES' ? 'PostgreSQL' : 'SQL'}`}
                icon={<LanguageIcon language={type} />}
                onSelect={() => openEditor({ Connection: { kind: type, id: uuid } })}
              />
            ))}
            <CommandItemWrapper
              name="Manage connections"
              description={
                <>
                  Connect to Postgres, MySQL, <LinkNewTabWrapper href={DOCUMENTATION_URL}>and more</LinkNewTabWrapper>
                </>
              }
              icon={<DatabaseIcon className="text-muted-foreground opacity-80" />}
              onSelect={() => {
                setEditorInteractionState({
                  ...editorInteractionState,
                  showCellTypeMenu: false,
                  showConnectionsMenu: true,
                });
              }}
            />
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function CommandItemWrapper({
  disabled,
  icon,
  name,
  experimental,
  description,
  onSelect,
  uuid,
}: {
  disabled?: boolean;
  icon: React.ReactNode;
  name: string;
  experimental?: boolean;
  description: string | JSX.Element;
  onSelect: () => void;
  uuid?: string;
}) {
  return (
    <CommandItem
      disabled={disabled}
      onSelect={onSelect}
      value={name + (uuid ? uuid : '')}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="mr-4 flex h-5 w-5 items-center">{icon}</div>
      <div className="flex flex-col">
        <span className="flex items-center">
          {name}{' '}
          {experimental && (
            <Badge variant="outline" className="ml-2">
              Experimental
            </Badge>
          )}
        </span>
        {/* <span className="text-xs text-muted-foreground">{description}</span> */}
      </div>
    </CommandItem>
  );
}

function LinkNewTabWrapper(props: any) {
  return (
    <LinkNewTab
      {...props}
      onClick={(e: React.SyntheticEvent) => {
        e.stopPropagation();
      }}
    />
  );
}
