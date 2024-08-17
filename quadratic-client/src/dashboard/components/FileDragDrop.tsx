import { useFileImport } from '@/app/ui/hooks/useFileImport';
import { DragEvent, useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { fileDragDropModalAtom } from '../atoms/fileDragDropModalAtom';

export function FileDragDrop() {
  const [fileDragDropModal, setFileDragDropModal] = useRecoilState(fileDragDropModalAtom);
  const handleFileImport = useFileImport();

  const handleDrag = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.type === 'dragleave') {
        setFileDragDropModal({ show: false, teamUuid: undefined, isPrivate: undefined });
      }
    },
    [setFileDragDropModal]
  );

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      setFileDragDropModal({ show: false, teamUuid: undefined, isPrivate: undefined });

      const files = e.dataTransfer.files;
      const { isPrivate, teamUuid } = fileDragDropModal;
      handleFileImport({ files, isPrivate, teamUuid });
    },
    [fileDragDropModal, handleFileImport, setFileDragDropModal]
  );

  if (!fileDragDropModal.show) return null;

  return (
    <div
      className="absolute left-0 top-0 z-10 flex h-full w-full flex-col items-center  justify-center bg-white opacity-90"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
    >
      <div
        className="relative z-10 h-[90%] w-[90%] select-none rounded-lg border-4 border-dashed border-border bg-white opacity-90"
        onDrop={handleDrop}
      >
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-4">
          <span className="text-2xl font-bold text-[#020817]">Drop file here</span>

          <span className="pl-4 pr-4 text-center text-base font-medium text-[#6A778B]">
            Start a new spreadsheet by importing a CSV, Parquet, Excel or Grid file(s)
          </span>
        </div>
      </div>
    </div>
  );
}
