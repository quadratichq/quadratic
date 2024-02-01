import { Button } from '@/shadcn/ui/button';
import { Input } from '@/shadcn/ui/input';
import { Cross2Icon } from '@radix-ui/react-icons';
import { FileListViewControlsDropdown } from './FilesListViewControlsDropdown';

export function FilesListViewControls({ filterValue, setFilterValue, viewPreferences, setViewPreferences }: any) {
  return (
    <div className={`flex flex-row items-center justify-between gap-2 pb-4 `}>
      <div className={`max-w relative flex-grow md:max-w-sm`}>
        <Input onChange={(e) => setFilterValue(e.target.value)} value={filterValue} placeholder="Filter by name…" />
        {filterValue && (
          <Button
            variant="ghost"
            size="icon"
            className={`absolute right-0 top-0 text-muted-foreground hover:bg-transparent`}
            onClick={() => setFilterValue('')}
            aria-label="Clear filter"
          >
            <Cross2Icon className={`h-4 w-4`} />
          </Button>
        )}
      </div>
      <div className={`flex flex-row items-center gap-2`}>
        <FileListViewControlsDropdown viewPreferences={viewPreferences} setViewPreferences={setViewPreferences} />
      </div>
    </div>
  );
}
