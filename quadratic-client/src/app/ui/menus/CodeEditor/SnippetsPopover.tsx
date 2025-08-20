import { codeEditorCodeCellAtom, codeEditorShowSnippetsPopoverAtom } from '@/app/atoms/codeEditorAtom';
import { snippetsJS } from '@/app/ui/menus/CodeEditor/snippetsJS';
import { snippetsPY } from '@/app/ui/menus/CodeEditor/snippetsPY';
import { ExternalLinkIcon, SnippetsIcon } from '@/shared/components/Icons';
import {
  DOCUMENTATION_JAVASCRIPT_URL,
  DOCUMENTATION_PYTHON_URL,
  WEBSITE_CHANGELOG,
  WEBSITE_CONNECTIONS,
  WEBSITE_EXAMPLES,
} from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/shadcn/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type * as monaco from 'monaco-editor';
import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

interface SnippetsPopoverProps {
  editorInst: monaco.editor.IStandaloneCodeEditor | null;
}

export function SnippetsPopover({ editorInst }: SnippetsPopoverProps) {
  const [showSnippetsPopover, setShowSnippetsPopover] = useRecoilState(codeEditorShowSnippetsPopoverAtom);
  const { language } = useRecoilValue(codeEditorCodeCellAtom);

  useEffect(() => {
    if (showSnippetsPopover === true) {
      trackEvent('[Snippets].opened');
    }
  }, [showSnippetsPopover]);

  const snippets = useMemo(() => (language === 'Javascript' ? snippetsJS : snippetsPY), [language]);
  const documentationLink = useMemo(
    () => (language === 'Javascript' ? DOCUMENTATION_JAVASCRIPT_URL : DOCUMENTATION_PYTHON_URL),
    [language]
  );
  return (
    <Popover
      open={showSnippetsPopover}
      onOpenChange={(value) => {
        setShowSnippetsPopover(value);
      }}
    >
      <TooltipPopover label={`Snippets`} side="bottom">
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            onClick={() => {
              setShowSnippetsPopover(true);
            }}
          >
            <SnippetsIcon />
          </Button>
        </PopoverTrigger>
      </TooltipPopover>

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
                    trackEvent('[Snippets].selected', { label });

                    if (editorInst) {
                      const selection = editorInst.getSelection();
                      if (!selection) return;
                      const id = { major: 1, minor: 1 };
                      const text = code;
                      const op = { identifier: id, range: selection, text: text, forceMoveMarkers: true };
                      editorInst.executeEdits('my-source', [op]);
                      setShowSnippetsPopover(false);
                      editorInst.focus();
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
                    trackEvent('[Snippets].clickConnections');
                  }}
                >
                  Connections
                </ExternalLink>
                ,{' '}
                <ExternalLink
                  href={WEBSITE_EXAMPLES}
                  onClick={() => {
                    trackEvent('[Snippets].clickExamples');
                  }}
                >
                  Examples
                </ExternalLink>
                , and{' '}
                <ExternalLink
                  href={WEBSITE_CHANGELOG}
                  onClick={() => {
                    trackEvent('[Snippets].clickChangelog');
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
            trackEvent('[Snippets].clickDocs');
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
