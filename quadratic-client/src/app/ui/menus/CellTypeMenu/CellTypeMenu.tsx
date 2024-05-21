import { cellTypeMenuOpenedCountAtom } from '@/app/atoms/cellTypeMenuOpenedCountAtom';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { LinkNewTab } from '@/app/ui/components/LinkNewTab';
import { DOCUMENTATION_FORMULAS_URL, DOCUMENTATION_PYTHON_URL, DOCUMENTATION_URL } from '@/shared/constants/urls';
import mixpanel from 'mixpanel-browser';
import React, { useCallback, useEffect } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import '../../styles/floating-dialog.css';

import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { useFileMetaRouteLoaderData } from '@/routes/_file.$uuid';
import { ROUTES } from '@/shared/constants/routes';
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
import { Add } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';

export interface CellTypeOption {
  name: string;
  mode: CodeCellLanguage;
  icon: any;
  description: string | JSX.Element;
  disabled?: boolean;
  experimental?: boolean;
}

let CELL_TYPE_OPTIONS = [
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
    mode: 'Formula',
    icon: <LanguageIcon language="Formula" />,
    description: (
      <>
        Classic spreadsheet logic like <code>SUM</code>, <code>AVERAGE</code>,{' '}
        <LinkNewTabWrapper href={DOCUMENTATION_FORMULAS_URL}>and more</LinkNewTabWrapper>.
      </>
    ),
  },

  // todo: (connections) create CodeCellLanguage for these types in Rust (when ready to implement)
  // {
  //   name: 'SQL Query',
  //   mode: 'Connection',
  //   icon: <Sql sx={{ color: colors.languageAI }} />,
  //   description: 'Import your data with queries.',
  //   disabled: false,
  // },
  {
    name: 'JavaScript',
    icon: <LanguageIcon language="Javascript" />,
    description: 'The world’s most popular programming language.',
    disabled: true,
    experimental: true,
  },
] as CellTypeOption[];

export default function CellTypeMenu() {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const setCellTypeMenuOpenedCount = useSetRecoilState(cellTypeMenuOpenedCountAtom);
  const { connections } = useFileMetaRouteLoaderData();
  const navigate = useNavigate();
  const { uuid } = useParams() as { uuid: string };
  const searchlabel = 'Choose a cell type…';

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
    focusGrid();
  }, [editorInteractionState, setEditorInteractionState]);

  const openEditor = useCallback(
    (mode: CodeCellLanguage) => {
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
    <CommandDialog dialogProps={{ open: true, onOpenChange: close }} commandProps={{}}>
      <CommandInput placeholder={searchlabel} id="CellTypeMenuInputID" />
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
        <CommandGroup heading="Connections">
          {connections.map(({ name, type, uuid }) => (
            <CommandItemWrapper
              key={uuid}
              name={name}
              description={`${type === 'POSTGRES' ? 'PostgreSQL' : 'SQL'}`}
              icon={<LanguageIcon language={type} />}
              onSelect={() => openEditor({ Connection: { kind: type, id: uuid } })}
            />
          ))}
          <CommandItemWrapper
            name="Create or manage connections"
            // TODO: (connections) correct URL here
            description={
              <>
                Connect to Postgres, MySQL, <LinkNewTabWrapper href={DOCUMENTATION_URL}>and more</LinkNewTabWrapper>
              </>
            }
            icon={<Add />}
            onSelect={() => {
              setEditorInteractionState({
                ...editorInteractionState,
                showCellTypeMenu: false,
              });
              navigate(ROUTES.FILE_CONNECTIONS(uuid), { replace: true });
            }}
          />
        </CommandGroup>
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
}: {
  disabled?: boolean;
  icon: React.ReactNode;
  name: string;
  experimental?: boolean;
  description: string | JSX.Element;
  onSelect: () => void;
}) {
  return (
    <CommandItem disabled={disabled} onSelect={onSelect}>
      <div className="mr-4">{icon}</div>
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
