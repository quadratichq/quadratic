import { Input } from '../../shadcn/ui/input';
import { FileListViewControlsDropdown } from './FilesListViewControlsDropdown';

export function FilesListViewControls({ filterValue, setFilterValue, viewPreferences, setViewPreferences }: any) {
  return (
    <div className={`flex flex-row items-center justify-between gap-2 pb-4 `}>
      <div className={`max-w flex-grow md:max-w-sm`}>
        <Input onChange={(e) => setFilterValue(e.target.value)} value={filterValue} placeholder="Filter by name…" />
      </div>
      <div className={`flex flex-row items-center gap-2`}>
        <FileListViewControlsDropdown viewPreferences={viewPreferences} setViewPreferences={setViewPreferences} />
      </div>
    </div>
  );
}
