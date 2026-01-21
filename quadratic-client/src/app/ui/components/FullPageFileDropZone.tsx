import { hasPermissionToEditFile } from '@/app/actions';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { isExcelMimeType } from '@/app/helpers/files';
import { useFileImport } from '@/app/ui/hooks/useFileImport';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

/**
 * Full-page drop zone for Excel and Grid files that need to load over the current file.
 * This component uses document-level event listeners to detect drag events,
 * then shows a full-page overlay for Excel/Grid files.
 */
export const FullPageFileDropZone = memo(() => {
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const canEdit = hasPermissionToEditFile(permissions);
  const [dragOver, setDragOver] = useState(false);
  const [fileType, setFileType] = useState<'excel' | 'grid' | null>(null);
  const dragCounterRef = useRef(0);
  const handleFileImport = useFileImport();

  // Check if the dragged file should use full-page drop zone
  // We can only reliably detect Excel files by MIME type during drag.
  // Grid files (.grid) often have empty MIME type, so we also check for that.
  // We verify the actual file type on drop.
  const checkForFullPageFileType = useCallback((e: DragEvent): 'excel' | 'grid' | null => {
    const items = e.dataTransfer?.items;
    if (!items || items.length === 0) return null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== 'file') continue;

      const mimeType = item.type;

      // Excel files - detectable by MIME type
      if (isExcelMimeType(mimeType)) {
        return 'excel';
      }

      // Grid files often have empty MIME type (browser doesn't recognize .grid extension)
      // We'll verify it's actually a .grid file on drop
      if (mimeType === '') {
        return 'grid';
      }
    }

    return null;
  }, []);

  // Emit event when full-page drag state changes
  useEffect(() => {
    events.emit('fullPageFileDrag', dragOver);
  }, [dragOver]);

  // Document-level drag event handlers
  useEffect(() => {
    if (!canEdit) return;

    const handleDocDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;

      dragCounterRef.current++;
      if (dragCounterRef.current === 1) {
        const type = checkForFullPageFileType(e);
        if (type) {
          setFileType(type);
          setDragOver(true);
        }
      }
    };

    const handleDocDragLeave = (e: DragEvent) => {
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setDragOver(false);
        setFileType(null);
      }
    };

    const handleDocDrop = () => {
      // Reset state on any drop (the overlay's drop handler will handle if visible)
      dragCounterRef.current = 0;
      setDragOver(false);
      setFileType(null);
    };

    document.addEventListener('dragenter', handleDocDragEnter);
    document.addEventListener('dragleave', handleDocDragLeave);
    document.addEventListener('drop', handleDocDrop);

    return () => {
      document.removeEventListener('dragenter', handleDocDragEnter);
      document.removeEventListener('dragleave', handleDocDragLeave);
      document.removeEventListener('drop', handleDocDrop);
    };
  }, [canEdit, checkForFullPageFileType]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounterRef.current = 0;
      setDragOver(false);
      setFileType(null);

      if (!canEdit) return;

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;

      // Check if any file is Excel or Grid
      const file = files[0];
      const isExcel = isExcelMimeType(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      const isGrid = file.name.endsWith('.grid');

      if (isExcel || isGrid) {
        // Handle full-page file import
        handleFileImport({
          files: Array.from(files),
          insertAt: { x: 1, y: 1 },
          sheetId: '',
          cursor: '',
        });
      }
    },
    [canEdit, handleFileImport]
  );

  if (!canEdit || !dragOver) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex h-[calc(100%-32px)] w-[calc(100%-32px)] flex-col items-center justify-center rounded-lg border-4 border-dashed border-primary p-8">
        <span className="text-2xl font-bold">
          {fileType === 'excel' ? 'Drop Excel file to import' : 'Drop Grid file to open'}
        </span>
        <span className="mt-2 text-center text-muted-foreground">
          {fileType === 'excel'
            ? 'Excel sheets will be imported as new sheets in this file'
            : 'The Grid file will replace the current file or open in a new tab'}
        </span>
      </div>
    </div>
  );
});
