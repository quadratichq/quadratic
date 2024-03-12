import { DOCUMENTATION_PYTHON_URL, WEBSITE_CHANGELOG, WEBSITE_CONNECTIONS, WEBSITE_EXAMPLES } from '@/constants/urls';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shadcn/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/shadcn/ui/popover';
import { TooltipHint } from '@/ui/components/TooltipHint';
import { ExternalLinkIcon } from '@/ui/icons';
import { IntegrationInstructionsOutlined } from '@mui/icons-material';
import { IconButton, useTheme } from '@mui/material';
import * as React from 'react';
import { useCodeEditor } from './CodeEditorContext';
import snippets from './snippets';

export function SnippetsPopover() {
  const { editorRef } = useCodeEditor();
  const { showSnippetsPopover, setShowSnippetsPopover } = useCodeEditor();
  const theme = useTheme();

  return (
    <Popover open={showSnippetsPopover} onOpenChange={setShowSnippetsPopover}>
      <PopoverTrigger asChild>
        <div>
          <TooltipHint title="Snippets" placement="bottom">
            <IconButton
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
              // if it's the ESC key just close the menu
              if (event.key === 'Escape') {
                event.stopPropagation();
                setShowSnippetsPopover(false);
              }
            }}
          />

          <CommandList>
            <CommandGroup>
              {snippets.map(({ label, code, description, keywords }) => (
                <CommandItem
                  key={label}
                  value={label}
                  keywords={[description, ...(keywords || [])]}
                  onSelect={(currentValue) => {
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
                Learn more via our <ExternalLink href={WEBSITE_CONNECTIONS}>Connections</ExternalLink>,{' '}
                <ExternalLink href={WEBSITE_EXAMPLES}>Examples</ExternalLink>, and{' '}
                <ExternalLink href={WEBSITE_CHANGELOG}>Changelog</ExternalLink> resources.
              </span>
            </CommandEmpty>
          </CommandList>
        </Command>
        <ExternalLink
          href={DOCUMENTATION_PYTHON_URL}
          className="flex w-full items-center gap-4 border-t border-border px-3 py-2 text-sm text-muted-foreground hover:underline"
        >
          <ExternalLinkIcon style={{ fontSize: '.875rem' }} className="opacity-80" />
          Read the docs
        </ExternalLink>
      </PopoverContent>
    </Popover>
  );
}

function ExternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`underline ${className ? className : ''}`}>
      {children}
    </a>
  );
}
