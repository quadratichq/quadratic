/**
 * ChangelogDialog Component
 *
 * Displays the in-app changelog viewer. The changelog data is stored locally in
 * `quadratic-client/src/shared/constants/changelog.json` and should be updated
 * with each release.
 *
 * To update the changelog for a new release:
 * 1. Add a new entry at the top of the changelog.json array
 * 2. Set the version to match the new release version
 * 3. Set the date to the release date (YYYY-MM-DD format)
 * 4. Add an array of changes for that version
 * 5. Optionally add a "details" field with HTML content for more detailed information
 * 6. Optionally add a "title" field as a short headline for the left pane (defaults to first change)
 *
 * Example entry:
 * {
 *   "version": "0.22.0",
 *   "date": "2024-12-25",
 *   "changes": [
 *     "New feature X",
 *     "Bug fix Y",
 *     "Performance improvements"
 *   ],
 *   "details": "<p>More detailed information with <strong>HTML</strong> support.</p>",
 *   "title": "Optional short headline for the left pane (defaults to first change)"
 * }
 */
import { changelogDialogAtom } from '@/shared/atom/changelogDialogAtom';
import changelogData from '@/shared/constants/changelog.json';
import { useChangelogNew } from '@/shared/hooks/useChangelogNew';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { Separator } from '@/shared/shadcn/ui/separator';
import { cn } from '@/shared/shadcn/utils';
import { useAtom } from 'jotai';
import { useEffect, useState } from 'react';

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
  details?: string | null;
  title?: string;
}

const formatDate = (date: string): string => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const getDisplayTitle = (entry: ChangelogEntry): string => entry.title ?? entry.changes[0] ?? '';

const CHANGELOG_ENTRIES: ChangelogEntry[] = changelogData as ChangelogEntry[];

export function ChangelogDialog() {
  const [open, setOpen] = useAtom(changelogDialogAtom);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(
    CHANGELOG_ENTRIES.length > 0 ? CHANGELOG_ENTRIES[0].version : null
  );
  const { markAsSeen } = useChangelogNew();

  const selectedEntry = CHANGELOG_ENTRIES.find((entry) => entry.version === selectedVersion) || CHANGELOG_ENTRIES[0];

  // Mark changelog as seen when dialog opens
  useEffect(() => {
    if (open) {
      markAsSeen();
    }
  }, [open, markAsSeen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className={cn(
          'h-[100vh] max-h-[100vh] w-[100vw] max-w-[100vw] translate-y-0 p-0 sm:h-auto sm:max-h-[calc(100vh-4rem)] sm:max-w-5xl sm:translate-y-3 sm:rounded-lg md:h-[80vh]',
          'gap-0'
        )}
        aria-describedby={undefined}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Changelog</DialogTitle>
        </DialogHeader>
        <div className="flex h-full flex-col overflow-hidden sm:flex-row">
          {/* Left Navigation Pane */}
          <div className="flex-shrink-0 border-b border-border bg-accent sm:w-64 sm:border-b-0 sm:border-r">
            <div className="flex h-full flex-col">
              <div className="w-full px-4 py-3">
                <h2 className="text-lg font-semibold">Changelog</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-1 px-2 py-2">
                  {CHANGELOG_ENTRIES.map((entry) => (
                    <button
                      key={entry.version}
                      onClick={() => setSelectedVersion(entry.version)}
                      className={cn(
                        'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                        'hover:bg-background/50',
                        selectedVersion === entry.version ? 'bg-background text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      <div className="truncate font-medium opacity-70">{getDisplayTitle(entry)}</div>
                      <div className="">v{entry.version}</div>
                      <div className="text-xs opacity-70">{formatDate(entry.date)}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Content Pane */}
          <div className="flex-1 overflow-y-auto bg-background p-6">
            {selectedEntry && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-semibold">Version {selectedEntry.version}</h3>
                  <p className="text-sm text-muted-foreground">{formatDate(selectedEntry.date)}</p>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    What's New
                  </h4>
                  <ul className="ml-4 list-disc space-y-2 text-sm">
                    {selectedEntry.changes.map((change, index) => (
                      <li key={index} className="text-foreground">
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
                {selectedEntry.details && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Details
                      </h4>
                      <div
                        className="changelog-details text-sm text-foreground [&_a:hover]:text-primary/80 [&_a]:text-primary [&_a]:underline [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p:last-child]:mb-0 [&_p]:mb-2 [&_strong]:font-semibold [&_ul]:mb-2 [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1"
                        dangerouslySetInnerHTML={{ __html: selectedEntry.details }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
