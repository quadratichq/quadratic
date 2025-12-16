import { EmptyState } from '@/shared/components/EmptyState';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';

export function FilesListEmptyFilterState() {
  return (
    <div className="flex min-h-80 items-center justify-center">
      <EmptyState title="No matches" description={'No files found matching your filters.'} Icon={MagnifyingGlassIcon} />
    </div>
  );
}
