import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { editorSchemaStateAtom } from '@/app/atoms/editorSchemaStateAtom';
import { getConnectionInfo } from '@/app/helpers/codeCellLanguage';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { SqlAdd } from '@/app/ui/icons';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { connectionClient } from '@/shared/api/connectionClient';
import { Type } from '@/shared/components/Type';
import { cn } from '@/shared/shadcn/utils';
import { KeyboardArrowRight, Refresh } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

type Table = {
  name: string;
  schema: string;
  columns: Column[];
};

type Column = {
  is_nullable: boolean;
  name: string;
  type: string;
};

type LoadState = 'not-initialized' | 'loading' | 'loaded' | 'error';
export type SchemaData = Awaited<ReturnType<typeof connectionClient.schemas.get>>;

interface Props {
  bottom?: boolean;
}

export const SchemaViewer = (props: Props) => {
  const { bottom } = props;
  const { mode } = useRecoilValue(editorInteractionStateAtom);

  const connection = getConnectionInfo(mode);
  if (!connection) throw new Error('Expected a connection cell to be open.');
  const [expandAll, setExpandAll] = useState(false);
  const [data, setData] = useRecoilState(editorSchemaStateAtom);

  // needs to be a ref to ensure only fetch is only called once
  const loadState = useRef<LoadState>('not-initialized');
  const [loadingAnimation, setLoadingAnimation] = useState(false);
  const fetchData = useCallback(async () => {
    if (loadState.current === 'loading') return;
    loadState.current = 'loading';
    setLoadingAnimation(true);
    const newSchemaData = await connectionClient.schemas.get(connection.kind.toLowerCase() as any, connection.id);
    setLoadingAnimation(false);
    if (newSchemaData) {
      setData({
        schema: newSchemaData,
      });
      loadState.current = 'loaded';
    } else {
      loadState.current = 'error';
    }
  }, [connection.id, connection.kind, setData]);

  useEffect(() => {
    if (loadState.current === 'not-initialized') {
      fetchData();
    }
  }, [fetchData, loadState]);

  // Designed to live in a box that takes up the full height of its container
  return (
    <div className="h-full overflow-scroll text-sm">
      <div className={cn('absolute z-50', bottom ? 'right-12 top-1.5' : 'right-1 top-1')}>
        <TooltipHint title="Refresh schema">
          <IconButton size="small" onClick={fetchData}>
            <Refresh fontSize="small" className={loadingAnimation ? 'animate-spin' : ''} />
          </IconButton>
        </TooltipHint>
      </div>
      {loadState.current === 'error' && (
        <Type className="m-3 mt-0 text-destructive">
          Error loading data schema.{' '}
          <button className="underline" onClick={fetchData}>
            Try again
          </button>{' '}
          or contact us.
        </Type>
      )}
      {data && (
        <ul>
          {data.schema?.tables.map((table, i) => (
            <TableListItem data={table} key={i} expandAll={expandAll} setExpandAll={setExpandAll} />
          ))}
        </ul>
      )}
    </div>
  );
};

function TableListItem({
  data: { name, columns },
  expandAll,
  setExpandAll,
}: {
  data: Table;
  expandAll: boolean;
  setExpandAll: any;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { editorRef } = useCodeEditor();
  const expanded = isExpanded || expandAll;

  const onQuery = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      if (!selection) return;
      const id = { major: 1, minor: 1 };
      const text = `SELECT * FROM "${name}" LIMIT 100`;
      const op = { identifier: id, range: selection, text: text, forceMoveMarkers: true };
      editorRef.current.executeEdits('my-source', [op]);
      editorRef.current.focus();
    }
  };

  return (
    <li>
      <div
        className={cn(
          'group/item sticky top-0 z-10 flex w-full cursor-default items-stretch justify-between gap-1 bg-background px-2 hover:bg-accent',
          expanded && 'bgz-accent'
        )}
        onClick={() => {
          setIsExpanded((prev) => !prev);
          if (expandAll) setExpandAll(false);
        }}
      >
        <div className="flex items-center truncate">
          <div className="flex h-6 w-6 items-center justify-center">
            <KeyboardArrowRight
              fontSize="inherit"
              className={cn(expanded && 'rotate-90', 'text-xs text-muted-foreground')}
            />
          </div>
          <div className="truncate">{name}</div>
        </div>

        <TooltipHint title="Query this table">
          <IconButton
            size="small"
            className={`${expanded ? '' : 'opacity-0'} group-hover/item:opacity-100`}
            onClick={onQuery}
          >
            <SqlAdd fontSize="inherit" />
          </IconButton>
        </TooltipHint>
      </div>
      {expanded && (
        <ul className="pl-5 pr-2">
          {columns.length ? (
            <div className="border border-l border-transparent border-l-border pl-3">
              <Type className="font-mono text-sm italic text-muted-foreground">[No columns]</Type>
            </div>
          ) : (
            columns.map(({ name, type, is_nullable }, k) => (
              <li key={k} className="border border-l border-transparent border-l-border pl-3">
                <div className="flex w-full items-center gap-1 py-0.5 pl-2">
                  <div className="truncate after:ml-1 after:text-muted-foreground after:opacity-30 after:content-['/']">
                    {name}
                  </div>

                  <div className="flex items-center gap-1 font-mono text-sm text-muted-foreground">
                    {type}
                    {is_nullable && '?'}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </li>
  );
}
