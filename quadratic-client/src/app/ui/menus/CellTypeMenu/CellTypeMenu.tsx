import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import {
  editorInteractionStateShowCellTypeMenuAtom,
  editorInteractionStateShowConnectionsMenuAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import '@/app/ui/styles/floating-dialog.css';
import { DatabaseIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
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
import mixpanel from 'mixpanel-browser';
import React, { useCallback, useEffect } from 'react';
import { useSetRecoilState } from 'recoil';

export interface CellTypeOption {
  name: string;
  searchStrings?: string[];
  mode: CodeCellLanguage;
  icon: any;
  disabled?: boolean;
  experimental?: boolean;
}

let CELL_TYPE_OPTIONS: CellTypeOption[] = [
  {
    name: 'Python',
    mode: 'Python',
    icon: <LanguageIcon language="Python" />,
  },
  {
    name: 'Formula',
    searchStrings: ['fx', 'functions', 'formulas'],
    mode: 'Formula',
    icon: <LanguageIcon language="Formula" />,
  },
  {
    name: 'JavaScript',
    searchStrings: ['js'],
    mode: 'Javascript',
    icon: <LanguageIcon language="Javascript" />,
    experimental: true,
  },
];

export default function CellTypeMenu() {
  const setShowCellTypeMenu = useSetRecoilState(editorInteractionStateShowCellTypeMenuAtom);
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const setCodeEditorState = useSetRecoilState(codeEditorAtom);
  const fetcher = useConnectionsFetcher();

  const searchLabel = 'Choose a cell type…';

  useEffect(() => {
    mixpanel.track('[CellTypeMenu].opened');
  }, []);

  const close = useCallback(() => {
    setShowCellTypeMenu(false);
  }, [setShowCellTypeMenu]);

  const openEditor = useCallback(
    (language: CodeCellLanguage) => {
      mixpanel.track('[CellTypeMenu].selected', { language });
      setShowCellTypeMenu(false);
      setCodeEditorState((prev) => ({
        ...prev,
        showCodeEditor: true,
        initialCode: '',
        codeCell: {
          ...prev.codeCell,
          language,
        },
      }));
    },
    [setCodeEditorState, setShowCellTypeMenu]
  );

  const manageConnections = useCallback(() => {
    setShowCellTypeMenu(false);
    setShowConnectionsMenu(true);
  }, [setShowCellTypeMenu, setShowConnectionsMenu]);

  return (
    <CommandDialog
      dialogProps={{ open: true, onOpenChange: close }}
      commandProps={{}}
      overlayProps={{ onPointerDown: (e) => e.preventDefault() }}
    >
      <CommandInput placeholder={searchLabel} id="CellTypeMenuInputID" />
      <CommandList id="CellTypeMenuID">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Languages">
          {CELL_TYPE_OPTIONS.map(({ name, disabled, experimental, icon, mode }, i) => (
            <CommandItemWrapper
              key={name}
              disabled={disabled}
              icon={icon}
              name={name}
              experimental={experimental}
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
                icon={<LanguageIcon language={type} />}
                onSelect={() => openEditor({ Connection: { kind: type, id: uuid } })}
              />
            ))}
            <CommandItemWrapper
              name="Manage connections"
              icon={<DatabaseIcon className="text-muted-foreground opacity-80" />}
              onSelect={manageConnections}
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
  onSelect,
  uuid,
}: {
  disabled?: boolean;
  icon: React.ReactNode;
  name: string;
  experimental?: boolean;
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
            <Badge variant="secondary" className="ml-2">
              Experimental
            </Badge>
          )}
        </span>
      </div>
    </CommandItem>
  );
}
