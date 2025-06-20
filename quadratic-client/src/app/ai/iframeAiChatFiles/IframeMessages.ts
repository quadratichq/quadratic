export type DbFile = {
  chatId: string;
  fileId: string;
  name: string;
  mimeType: string;
  lastModified: number;
  size: number;
  data: ArrayBuffer;
};

export type FromIframeReady = {
  type: 'iframe-indexeddb-ready';
};

export type ToIframeSaveFiles = {
  type: 'save-files';
  dbFiles: DbFile[];
};
export type FromIframeSaveFilesResponse = {
  type: 'save-files-response';
  success: boolean;
  error?: any;
};

export type ToIframeGetFiles = {
  type: 'get-files';
  chatId: string;
};
export type FromIframeGetFilesResponse = {
  type: 'get-files-response';
  dbFiles: DbFile[];
};

export type ToIframeMessages = ToIframeGetFiles | ToIframeSaveFiles;
export type FromIframeMessages =
  | FromIframeSaveFilesResponse
  | FromIframeReady
  | FromIframeGetFilesResponse
  | FromIframeSaveFilesResponse;
