import { useFileContext } from '@/app/ui/components/FileProvider';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CheckIcon } from '@/shared/components/Icons';
import { useFileRouteLoaderDataRequired } from '@/shared/hooks/useFileRouteLoaderData';
import { Button } from '@/shared/shadcn/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/shadcn/ui/command';
import { Label } from '@/shared/shadcn/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { cn } from '@/shared/shadcn/utils';
import { CaretSortIcon } from '@radix-ui/react-icons';
import { useMemo, useState } from 'react';

interface TimezoneGroup {
  label: string;
  timezones: Array<{ value: string; label: string }>;
}

// Get all available timezones from the browser and group them by region
function getTimezoneGroups(): TimezoneGroup[] {
  // Get all IANA timezone identifiers from the browser
  const allTimezones = Intl.supportedValuesOf('timeZone');

  // Group by continent/region
  const grouped = new Map<string, string[]>();

  allTimezones.forEach((tz) => {
    // Skip single-word timezones (UTC, GMT, etc.) - we'll add UTC manually at the top
    const parts = tz.split('/');
    if (parts.length < 2) return;

    // Skip Etc/ timezones (deprecated/special)
    if (tz.startsWith('Etc/')) return;

    const region = parts[0];
    if (!grouped.has(region)) {
      grouped.set(region, []);
    }
    grouped.get(region)!.push(tz);
  });

  // Convert to our group format and sort
  const groups: TimezoneGroup[] = [];

  // Define preferred region order
  const regionOrder = [
    'America',
    'Europe',
    'Asia',
    'Australia',
    'Pacific',
    'Africa',
    'Atlantic',
    'Indian',
    'Antarctica',
  ];

  regionOrder.forEach((region) => {
    const timezones = grouped.get(region);
    if (timezones) {
      groups.push({
        label: region,
        timezones: timezones.sort().map((tz) => ({
          value: tz,
          label: tz.split('/').slice(1).join(' - ').replace(/_/g, ' '),
        })),
      });
    }
  });

  // Add UTC at the top
  groups.unshift({
    label: 'UTC',
    timezones: [{ value: 'UTC', label: 'UTC' }],
  });

  return groups;
}

export const ScheduledTasksTimezone = () => {
  const {
    userMakingRequest: { filePermissions },
  } = useFileRouteLoaderDataRequired();
  const { timezone, updateTimezone } = useFileContext();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [open, setOpen] = useState(false);

  // Get timezone groups (memoized to avoid recalculation)
  const timezoneGroups = useMemo(() => getTimezoneGroups(), []);

  // Get user's browser timezone as fallback
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const currentTimezone = timezone ?? browserTimezone;

  // Check if user can edit
  const canEdit = filePermissions.includes('FILE_EDIT');

  const handleTimezoneChange = (newTimezone: string) => {
    if (!canEdit) return;

    setOpen(false);
    try {
      updateTimezone(newTimezone);
    } catch (error) {
      console.error('Failed to update timezone:', error);
      addGlobalSnackbar('Failed to update timezone. Try again.', { severity: 'error' });
    }
  };

  // Get display label for current timezone
  const getCurrentTimezoneLabel = () => {
    // Search through all groups for the current timezone
    for (const group of timezoneGroups) {
      const tz = group.timezones.find((t) => t.value === currentTimezone);
      if (tz) return tz.label;
    }

    // If not found, format it nicely
    if (currentTimezone === 'UTC') return 'UTC';
    return currentTimezone.split('/').slice(1).join(' - ').replace(/_/g, ' ') || currentTimezone;
  };

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/30 px-4 py-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground">Timezone for scheduled tasks</Label>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={!canEdit}
              className="w-full justify-between text-xs font-normal"
            >
              <span className="truncate">{getCurrentTimezoneLabel()}</span>
              <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search timezones..." className="h-9" />
              <CommandList>
                <CommandEmpty>No timezone found.</CommandEmpty>
                {timezoneGroups.map((group) => (
                  <CommandGroup
                    key={group.label}
                    heading={
                      group.timezones.length === 1 && group.label === group.timezones[0].label ? undefined : group.label
                    }
                  >
                    {group.timezones.map((tz) => (
                      <CommandItem
                        key={tz.value}
                        value={tz.value}
                        keywords={[tz.label]}
                        onSelect={() => handleTimezoneChange(tz.value)}
                        className="text-xs"
                      >
                        {tz.label}
                        <CheckIcon
                          className={cn('ml-auto h-4 w-4', currentTimezone === tz.value ? 'opacity-100' : 'opacity-0')}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p className="text-[10px] text-muted-foreground">Local execution uses your browser's timezone.</p>
      </div>
    </div>
  );
};
