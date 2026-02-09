import {
  restoreFileViewStateAtom,
  showCellTypeOutlinesAtom,
  showCodePeekAtom,
  showGridLinesAtom,
  showHeadingsAtom,
  showScrollbarsAtom,
} from '@/app/atoms/gridSettingsAtom';
import { Label } from '@/shared/shadcn/ui/label';
import { Separator } from '@/shared/shadcn/ui/separator';
import { Switch } from '@/shared/shadcn/ui/switch';
import { useRecoilState } from 'recoil';

export function GeneralSettings() {
  const [showHeadings, setShowHeadings] = useRecoilState(showHeadingsAtom);
  const [showGridLines, setShowGridLines] = useRecoilState(showGridLinesAtom);
  const [showCellTypeOutlines, setShowCellTypeOutlines] = useRecoilState(showCellTypeOutlinesAtom);
  const [showCodePeek, setShowCodePeek] = useRecoilState(showCodePeekAtom);
  const [showScrollbars, setShowScrollbars] = useRecoilState(showScrollbarsAtom);
  const [restoreFileViewState, setRestoreFileViewState] = useRecoilState(restoreFileViewStateAtom);

  return (
    <div className="space-y-6">
      {/* Spreadsheet Settings Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-normal text-muted-foreground">Customize what you see in the spreadsheet</h3>
        </div>

        <div className="space-y-0">
          <div className="flex items-center justify-between py-3">
            <Label htmlFor="show-headings" className="cursor-pointer">
              Row and column headings
            </Label>
            <Switch id="show-headings" checked={showHeadings} onCheckedChange={setShowHeadings} />
          </div>
          <Separator />

          <div className="flex items-center justify-between py-3">
            <Label htmlFor="show-grid-lines" className="cursor-pointer">
              Grid lines
            </Label>
            <Switch id="show-grid-lines" checked={showGridLines} onCheckedChange={setShowGridLines} />
          </div>
          <Separator />

          <div className="flex items-center justify-between py-3">
            <Label htmlFor="show-scrollbars" className="cursor-pointer">
              Scrollbars
            </Label>
            <Switch id="show-scrollbars" checked={showScrollbars} onCheckedChange={setShowScrollbars} />
          </div>
          <Separator />

          <div className="flex items-center justify-between py-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="show-cell-outlines" className="cursor-pointer">
                Code cell outlines
              </Label>
              <div className="text-xs text-muted-foreground">Draw borders around code cells in the spreadsheet</div>
            </div>
            <Switch id="show-cell-outlines" checked={showCellTypeOutlines} onCheckedChange={setShowCellTypeOutlines} />
          </div>
          <Separator />

          <div className="flex items-center justify-between py-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="show-code-peek" className="cursor-pointer">
                Code peek
              </Label>
              <div className="text-xs text-muted-foreground">
                Show a summary of the code when hovering over a code cell
              </div>
            </div>
            <Switch id="show-code-peek" checked={showCodePeek} onCheckedChange={setShowCodePeek} />
          </div>
          <Separator />

          <div className="flex items-center justify-between py-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="restore-file-view-state" className="cursor-pointer">
                Restore sheet when reopening files
              </Label>
              <div className="text-xs text-muted-foreground">
                Save your current sheet, cursor, and view on your local machine so when you open the file again, you
                continue work where you left off.
              </div>
            </div>
            <Switch
              id="restore-file-view-state"
              checked={restoreFileViewState}
              onCheckedChange={setRestoreFileViewState}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
