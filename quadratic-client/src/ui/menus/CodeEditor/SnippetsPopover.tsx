import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/shadcn/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/shadcn/ui/popover';
import { ExternalLinkIcon } from '@/ui/icons';
import { IntegrationInstructionsOutlined } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import * as React from 'react';
import snippets from './snippets';

export function SnippetsPopover() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* <TooltipHint title="Snippets" placement="bottom"> */}
        <IconButton>
          <IntegrationInstructionsOutlined fontSize="small" />
        </IconButton>
        {/* </TooltipHint> */}
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder="Search snippets..." />
          <CommandEmpty>No snippets found.</CommandEmpty>
          <CommandGroup>
            {snippets.map(({ label, code, description }) => (
              <CommandItem
                key={label}
                value={label}
                onSelect={(currentValue) => {
                  console.log('selected');
                }}
                className="flex flex-col items-start"
              >
                <span className="font-medium">{label}</span>
                <span className="text-sx leading-snug text-muted-foreground">{description}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
        <a
          href=""
          className="flex items-center gap-4 border-t border-border px-3 py-2 text-sm text-muted-foreground hover:underline"
        >
          <ExternalLinkIcon style={{ fontSize: '.875rem' }} className="opacity-80" />
          Read the docs
        </a>
      </PopoverContent>
    </Popover>
  );
}
