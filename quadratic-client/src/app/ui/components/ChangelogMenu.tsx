import { focusGrid } from '@/app/helpers/focusGrid';
import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import { BoxIcon, ExternalLinkIcon } from '@/shared/components/Icons';
import { VERSION } from '@/shared/constants/appConstants';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { useState } from 'react';

interface ChangelogVersion {
  version: string;
  changelogUrl: string;
}

// Static changelog versions - these are hardcoded as requested
const CHANGELOG_VERSIONS: ChangelogVersion[] = [
  { version: 'AI usability', changelogUrl: 'https://www.quadratichq.com/changelog/ai-usability' },
  { version: 'New models', changelogUrl: 'https://www.quadratichq.com/changelog/new-models-and-bug-fixes' },
  { version: 'Agentic AI', changelogUrl: 'https://www.quadratichq.com/changelog/new-tools-for-agentic-ai' },
];

export const ChangelogMenu = () => {
  const [showChangelogMenu, setShowChangelogMenu] = useState(false);

  return (
    <Popover open={showChangelogMenu} onOpenChange={setShowChangelogMenu}>
      <SidebarTooltip label="Changelog">
        <PopoverTrigger asChild>
          <SidebarToggle pressed={showChangelogMenu} onPressedChange={() => setShowChangelogMenu(!showChangelogMenu)}>
            <BoxIcon />
          </SidebarToggle>
        </PopoverTrigger>
      </SidebarTooltip>

      <PopoverContent
        side="right"
        align="end"
        className="w-80"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusGrid();
        }}
      >
        <h2 className="text-md font-semibold">Changelog</h2>
        <p className="mb-4 text-xs text-muted-foreground">Current version: {VERSION || 'Unknown'}</p>

        <div className="space-y-2">
          {CHANGELOG_VERSIONS.map((item) => (
            <div key={item.version} className="flex items-center justify-between rounded-md p-2 hover:bg-accent">
              <span className="text-sm font-medium">{item.version}</span>
              <a
                href={item.changelogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                View changelog
                <ExternalLinkIcon size="sm" className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
