import type { DbFile } from '@/app/ai/iframeAiChatFiles/IframeMessages';
import { getExtension, uploadFile } from '@/app/helpers/files';
import { useCallback, useEffect, useState } from 'react';

const IFRAME_INDEXEDDB_ORIGIN = window.location.origin;

const AI_CHAT_FILE_TYPES = ['image/*', '.pdf', '.xlsx', '.xls', '.csv', '.parquet', '.parq', '.pqt'];

export const useIframeAIChatFiles = (iframeRef: React.RefObject<HTMLIFrameElement | null>, chatId: string) => {
  const [files, setFiles] = useState<DbFile[]>([]);
  const [dragging, setDragging] = useState(false);

  const handleUploadFiles = useCallback(
    async (files?: File[]) => {
      if (!iframeRef.current) return;

      if (!files) {
        files = await uploadFile(AI_CHAT_FILE_TYPES);
      }

      const dbFiles = await Promise.all(
        files.map(async (file) => {
          return {
            chatId,
            fileId: crypto.randomUUID(),
            name: file.name,
            mimeType: file.type,
            lastModified: file.lastModified,
            size: file.size,
            data: await file.arrayBuffer(),
          };
        })
      );

      const transferables = dbFiles.map((file) => file.data);

      iframeRef.current.contentWindow?.postMessage(
        { type: 'save-files', dbFiles },
        IFRAME_INDEXEDDB_ORIGIN,
        transferables
      );
    },
    [chatId, iframeRef]
  );

  const handleDeleteFiles = useCallback(
    (fileIds: string[]) => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'delete-files', chatId, fileIds }, IFRAME_INDEXEDDB_ORIGIN);
    },
    [chatId, iframeRef]
  );

  const handleFileDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files;
      if (!files) return;

      const supportedFiles = Array.from(files).filter(
        (file) =>
          file.type.startsWith('image/') ||
          AI_CHAT_FILE_TYPES.includes(`.${getExtension(file.name).toLowerCase()}`) ||
          AI_CHAT_FILE_TYPES.includes(file.type)
      );

      handleUploadFiles(supportedFiles);
    },
    [handleUploadFiles]
  );

  const handleSetDragging = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      switch (e.type) {
        case 'dragover':
          setDragging(e.clientX > 0 && e.clientY > 0);
          break;
        case 'dragleave':
          setDragging(e.clientX > 0 && e.clientY > 0);
          break;
        case 'drop':
          setDragging(false);
          handleFileDrop(e);
          break;
      }
    },
    [handleFileDrop]
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== IFRAME_INDEXEDDB_ORIGIN) return;

      switch (event.data.type) {
        case 'iframe-indexeddb-ready':
          break;
        case 'save-files-response':
          setFiles((prev) => [...prev, ...event.data.dbFiles]);
          break;
        case 'delete-files-response':
          setFiles((prev) => prev.filter((file) => !event.data.fileIds.includes(file.fileId)));
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    window.addEventListener('dragover', handleSetDragging);
    window.addEventListener('dragleave', handleSetDragging);
    window.addEventListener('drop', handleSetDragging);
    return () => {
      window.removeEventListener('dragover', handleSetDragging);
      window.removeEventListener('dragleave', handleSetDragging);
      window.removeEventListener('drop', handleSetDragging);
    };
  }, [handleSetDragging]);

  return { iframeRef, files, handleUploadFiles, handleDeleteFiles, dragging, handleSetDragging };
};
