import type { ReactNode } from 'react';

export function FilesListControlsRow({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-row items-center gap-2">{children}</div>;
}
