import { codeEditorShowSnippetsPopoverAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateModeAtom } from '@/app/atoms/editorInteractionStateAtom';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { snippetsJS } from '@/app/ui/menus/CodeEditor/snippetsJS';
import { snippetsPY } from '@/app/ui/menus/CodeEditor/snippetsPY';
import { ExternalLinkIcon } from '@/shared/components/Icons';
import {
  DOCUMENTATION_JAVASCRIPT_URL,
  DOCUMENTATION_PYTHON_URL,
  WEBSITE_CHANGELOG,
  WEBSITE_CONNECTIONS,
  WEBSITE_EXAMPLES,
} from '@/shared/constants/urls';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/shadcn/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { IntegrationInstructionsOutlined } from '@mui/icons-material';
import { IconButton, useTheme } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import * as monaco from 'monaco-editor';
import { ReactNode, useEffect, useMemo } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

type SnippetsPopoverProps = {
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>;
};

export function SnippetsPopover({ editorRef }: SnippetsPopoverProps) {
  const [showSnippetsPopover, setShowSnippetsPopover] = useRecoilState(codeEditorShowSnippetsPopoverAtom);
  const editorInteractionStateMode = useRecoilValue(editorInteractionStateModeAtom);
  const theme = useTheme();

  useEffect(() => {
    if (showSnippetsPopover === true) {
      mixpanel.track('[Snippets].opened');
    }
  }, [showSnippetsPopover]);

  const snippets = useMemo(
    () => (editorInteractionStateMode === 'Javascript' ? snippetsJS : snippetsPY),
    [editorInteractionStateMode]
  );
  const documentationLink = useMemo(
    () => (editorInteractionStateMode === 'Javascript' ? DOCUMENTATION_JAVASCRIPT_URL : DOCUMENTATION_PYTHON_URL),
    [editorInteractionStateMode]
  );
  return (
    <Popover open={showSnippetsPopover} onOpenChange={setShowSnippetsPopover}>
      <PopoverTrigger asChild>
        <div>
          <TooltipHint title="Snippets" placement="bottom">
            <IconButton
              size="small"
              style={{
                ...(showSnippetsPopover
                  ? {
                      backgroundColor: theme.palette.action.hover,
                    }
                  : {}),
              }}
            >
              <IntegrationInstructionsOutlined fontSize="small" />
            </IconButton>
          </TooltipHint>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command
          filter={(value, search, keywords) => {
            const valueToSearch = value.toLowerCase() + ' ' + (keywords ? keywords.join(' ').toLowerCase() : '');
            return valueToSearch.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder="Search snippets..."
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                setShowSnippetsPopover(false);
              }
            }}
          />

          <CommandList className="max-h-48">
            <CommandGroup>
              {snippets.map(({ label, code, keywords }) => (
                <CommandItem
                  key={label}
                  value={label}
                  keywords={keywords ? [keywords] : []}
                  onSelect={() => {
                    mixpanel.track('[Snippets].selected', { label });

                    if (editorRef.current) {
                      const selection = editorRef.current.getSelection();
                      if (!selection) return;
                      const id = { major: 1, minor: 1 };
                      const text = code;
                      const op = { identifier: id, range: selection, text: text, forceMoveMarkers: true };
                      editorRef.current.executeEdits('my-source', [op]);
                      setShowSnippetsPopover(false);
                      editorRef.current.focus();
                    }
                  }}
                  className="flex flex-col items-start"
                >
                  <span>{label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandEmpty>
              No results.
              <span className="mt-2 block px-2 text-xs text-muted-foreground">
                Learn more via our{' '}
                <ExternalLink
                  href={WEBSITE_CONNECTIONS}
                  onClick={() => {
                    mixpanel.track('[Snippets].clickConnections');
                  }}
                >
                  Connections
                </ExternalLink>
                ,{' '}
                <ExternalLink
                  href={WEBSITE_EXAMPLES}
                  onClick={() => {
                    mixpanel.track('[Snippets].clickExamples');
                  }}
                >
                  Examples
                </ExternalLink>
                , and{' '}
                <ExternalLink
                  href={WEBSITE_CHANGELOG}
                  onClick={() => {
                    mixpanel.track('[Snippets].clickChangelog');
                  }}
                >
                  Changelog
                </ExternalLink>{' '}
                resources.
              </span>
            </CommandEmpty>
          </CommandList>
        </Command>
        <ExternalLink
          href={documentationLink}
          onClick={() => {
            mixpanel.track('[Snippets].clickDocs');
          }}
          className="flex w-full items-center justify-between gap-4 border-t border-border px-3 py-2 text-sm text-muted-foreground hover:underline"
        >
          Read the docs
          <ExternalLinkIcon className="float-right opacity-50" />
        </ExternalLink>
      </PopoverContent>
    </Popover>
  );
}

function ExternalLink({
  children,
  className,
  ...props
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <a {...props} target="_blank" rel="noreferrer" className={`underline ${className ? className : ''}`}>
      {children}
    </a>
  );
}
